import { isLocalDatabase } from "../../src/db/local";

/**
 * The suite's own access to its database, as the owner: it resets the admin
 * account and the audit log, which the site's role may not rewrite. CI sets
 * DATABASE_OWNER_URL; locally, one user serves both (DATABASE_URL).
 */
export function ownerDatabaseUrl(): string {
  const owner = process.env.DATABASE_OWNER_URL ?? "";
  const url = owner === "" ? (process.env.DATABASE_URL ?? "") : owner;
  if (!isLocalDatabase(url)) {
    throw new Error(
      "The suite writes to its database: run it with a local DATABASE_URL (and DATABASE_OWNER_URL, if set).",
    );
  }
  return url;
}
