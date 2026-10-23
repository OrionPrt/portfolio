import "server-only";

import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { parseServerEnv } from "@/lib/env";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { logger } from "@/lib/logger";
import { err, type Result } from "@/lib/result";

import { DB_UNAVAILABLE } from "./query";
import * as schema from "./schema";
import type { Database } from "./types";

/** Longest wait for one query: past it, the read fails like an outage instead of hanging. */
const QUERY_TIMEOUT_MS = 8000;

let database: Database | undefined;

/** Neon over HTTP: one round trip per query, no connection to keep alive between requests. */
function connect(): Database | undefined {
  if (database === undefined) {
    const { DATABASE_URL } = parseServerEnv(process.env);
    if (DATABASE_URL === undefined) {
      return undefined;
    }
    // Global to the driver, and only read by its HTTP queries.
    neonConfig.fetchFunction = fetchWithTimeout(fetch, QUERY_TIMEOUT_MS);
    database = drizzle({ client: neon(DATABASE_URL), schema });
  }
  return database;
}

/**
 * Runs a read against the production database. Without DATABASE_URL the read
 * fails like an outage (logged, DB_UNAVAILABLE) instead of crashing the page.
 */
export async function withDatabase<T>(
  read: (db: Database) => Promise<Result<T>>,
): Promise<Result<T>> {
  let db: Database | undefined;
  try {
    db = connect();
  } catch (error) {
    logger.error("db.connect_failed", { error });
    return err(DB_UNAVAILABLE);
  }
  if (db === undefined) {
    logger.error("db.not_configured", { variable: "DATABASE_URL" });
    return err(DB_UNAVAILABLE);
  }
  return read(db);
}
