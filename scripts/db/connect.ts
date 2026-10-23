import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import * as schema from "@/db/schema";
import { parseServerEnv } from "@/lib/env";
import { describeErrorChain } from "@/lib/error-chain";

export type ScriptDatabase = NeonDatabase<typeof schema>;

/** Exit code 1 without throwing, so the pool still closes. */
export function fail(message: string): void {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

/**
 * Runs one step against DATABASE_URL (read from .env.local by the package
 * script). Scripts use Neon's WebSocket pool rather than the HTTP driver of
 * the app, because migrations and the seed need transactions.
 */
export async function runWithDatabase(
  task: string,
  step: (db: ScriptDatabase) => Promise<string>,
): Promise<void> {
  let databaseUrl: string | undefined;
  try {
    databaseUrl = parseServerEnv(process.env).DATABASE_URL;
  } catch (error) {
    fail(`${task}: ${describeErrorChain(error)}`);
    return;
  }
  if (databaseUrl === undefined) {
    fail(`${task}: DATABASE_URL is not set (add it to .env.local).`);
    return;
  }

  // The host only, never the credentials: shows which database a run targets.
  const target = new URL(databaseUrl).host;
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const summary = await step(drizzle({ client: pool, schema }));
    process.stdout.write(`${task} (${target}): ${summary}\n`);
  } catch (error) {
    fail(`${task} (${target}) failed: ${describeErrorChain(error)}`);
  } finally {
    await pool.end();
  }
}
