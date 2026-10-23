import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type * as schema from "./schema";

export type Schema = typeof schema;

/**
 * Any Drizzle Postgres database with our schema: Neon over HTTP in production,
 * PGlite in tests. Repositories depend on this type, never on a driver.
 */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;
