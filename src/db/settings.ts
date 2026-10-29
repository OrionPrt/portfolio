// Settings the site's driver and the roles script share: a plain module, safe
// to import from scripts (no "server-only").

/** The role the site connects as: data changes only, no schema change. */
export const APP_ROLE = "portfolio_app";

/** Longest wait for one query: past it, the read fails like an outage instead of hanging. */
export const QUERY_TIMEOUT_MS = 8000;
