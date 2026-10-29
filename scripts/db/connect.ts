import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { isLocalDatabase } from "@/db/local";
import {
  describeTarget,
  scriptDatabase,
  type ScriptDatabase,
  type ScriptRole,
} from "@/db/script-url";
import * as schema from "@/db/schema";
import type { Database } from "@/db/types";
import { parseServerEnv } from "@/lib/env";
import { describeErrorChain } from "@/lib/error-chain";

/** One open connection: the database, its migrator, and how to close it. */
export interface ScriptConnection {
  readonly db: Database;
  readonly migrate: (migrationsFolder: string) => Promise<void>;
  readonly close: () => Promise<void>;
}

/** Exit code 1 without throwing, so the connection still closes. */
export function fail(message: string): void {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

/**
 * Scripts need transactions (migrations, seed), which Neon's HTTP driver lacks:
 * they use its WebSocket pool, or plain Postgres for a local database (CI, dev).
 */
function open(databaseUrl: string): ScriptConnection {
  if (isLocalDatabase(databaseUrl)) {
    const client = postgres(databaseUrl, { max: 1, onnotice: () => undefined });
    const db = drizzlePostgres({ client, schema });
    return {
      db,
      migrate: (migrationsFolder) => migratePostgres(db, { migrationsFolder }),
      close: () => client.end(),
    };
  }
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzleNeon({ client: pool, schema });
  return {
    db,
    migrate: (migrationsFolder) => migrateNeon(db, { migrationsFolder }),
    close: () => pool.end(),
  };
}

function readDatabase(
  task: string,
  role: ScriptRole,
): ScriptDatabase | undefined {
  try {
    const database = scriptDatabase(parseServerEnv(process.env), role);
    if (database === undefined) {
      fail(
        `${task}: ${role === "owner" ? "DATABASE_OWNER_URL nor DATABASE_URL is" : "DATABASE_URL is not"} set (add it to .env.local).`,
      );
    }
    return database;
  } catch (error) {
    fail(`${task}: ${describeErrorChain(error)}`);
    return undefined;
  }
}

/**
 * Runs one step against the database (read from .env.local by the package
 * script): as the owner (DATABASE_OWNER_URL, else DATABASE_URL) for the
 * schema, the seed and the roles, as the site (DATABASE_URL) otherwise.
 */
export async function runWithDatabase(
  task: string,
  step: (connection: ScriptConnection, url: string) => Promise<string>,
  role: ScriptRole = "app",
): Promise<void> {
  const database = readDatabase(task, role);
  if (database === undefined) {
    return;
  }
  // The variable, user and host only, never the password: which database a run targets.
  const target = describeTarget(database);
  const connection = open(database.url);
  try {
    const summary = await step(connection, database.url);
    process.stdout.write(`${task} (${target}): ${summary}\n`);
  } catch (error) {
    fail(`${task} (${target}) failed: ${describeErrorChain(error)}`);
  } finally {
    await connection.close();
  }
}
