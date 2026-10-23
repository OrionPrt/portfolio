import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "@/db/schema";
import type { Database } from "@/db/types";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url));

export interface TestDatabase {
  readonly db: Database;
  /** Raw SQL, for assertions that bypass the ORM (constraints, catalog queries). */
  readonly exec: (sql: string) => Promise<unknown>;
  readonly query: <Row>(sql: string) => Promise<Row[]>;
  /** Empties every application table, keeping the schema. */
  readonly reset: () => Promise<void>;
  readonly close: () => Promise<void>;
}

/**
 * An in-memory PostgreSQL (PGlite) migrated with the real migration files,
 * so tests exercise the exact schema production runs.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  // PGlite follows the host's time zone; Neon runs in UTC.
  await client.exec("set time zone 'UTC'");
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  const reset = async (): Promise<void> => {
    const { rows } = await client.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public'",
    );
    const tables = rows.map(({ tablename }) => `"${tablename}"`).join(", ");
    if (tables !== "") {
      await client.exec(`truncate ${tables} restart identity cascade`);
    }
  };

  return {
    db,
    exec: (sql) => client.exec(sql),
    query: async <Row>(sql: string) => (await client.query<Row>(sql)).rows,
    reset,
    close: () => client.close(),
  };
}
