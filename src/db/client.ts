import "server-only";

import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { parseServerEnv } from "@/lib/env";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { logger } from "@/lib/logger";
import { err, type Result } from "@/lib/result";

import { isLocalDatabase } from "./local";
import { DB_UNAVAILABLE } from "./query";
import * as schema from "./schema";
import type { Database } from "./types";

/** Longest wait for one query: past it, the read fails like an outage instead of hanging. */
const QUERY_TIMEOUT_MS = 8000;

let connection: Promise<Database | undefined> | undefined;

/** Neon over HTTP: one round trip per query, no connection to keep alive between requests. */
function connectToNeon(databaseUrl: string): Database {
  // Global to the driver, and only read by its HTTP queries.
  neonConfig.fetchFunction = fetchWithTimeout(fetch, QUERY_TIMEOUT_MS);
  return drizzle({ client: neon(databaseUrl), schema });
}

/** Development and CI databases speak plain Postgres; production never loads this driver. */
async function connectLocally(databaseUrl: string): Promise<Database> {
  const [{ default: postgres }, { drizzle: drizzlePostgres }] =
    await Promise.all([import("postgres"), import("drizzle-orm/postgres-js")]);
  const client = postgres(databaseUrl, {
    connect_timeout: QUERY_TIMEOUT_MS / 1000,
    connection: { statement_timeout: QUERY_TIMEOUT_MS },
  });
  return drizzlePostgres({ client, schema });
}

async function open(): Promise<Database | undefined> {
  const { DATABASE_URL, VERCEL_ENV } = parseServerEnv(process.env);
  if (DATABASE_URL === undefined) {
    return undefined;
  }
  if (!isLocalDatabase(DATABASE_URL)) {
    return connectToNeon(DATABASE_URL);
  }
  // On Vercel a local host can only be a configuration mistake.
  if (VERCEL_ENV === "production" || VERCEL_ENV === "preview") {
    throw new Error("A local DATABASE_URL is not allowed on Vercel.");
  }
  return connectLocally(DATABASE_URL);
}

/** One connection per process, shared by concurrent first reads; a failed setup is retried. */
function connect(): Promise<Database | undefined> {
  connection ??= open().catch((error: unknown) => {
    connection = undefined;
    throw error;
  });
  return connection;
}

/**
 * Runs a read against the configured database. Without DATABASE_URL the read
 * fails like an outage (logged, DB_UNAVAILABLE) instead of crashing the page.
 */
export async function withDatabase<T>(
  read: (db: Database) => Promise<Result<T>>,
): Promise<Result<T>> {
  let db: Database | undefined;
  try {
    db = await connect();
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
