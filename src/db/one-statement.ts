import type { SQLWrapper } from "drizzle-orm";

import type { Database } from "./types";

/**
 * Writes that run with the statement a caller ends with:
 * `db.with(...alongside(db, writes)).insert(…)`. One statement, so they all
 * happen or none do (Neon over HTTP has no interactive transaction). They
 * share one snapshot and run in no set order: each touches rows the others
 * leave alone. Foreign keys are checked once all have run, so a row may be
 * written alongside its parent.
 */
export function alongside(db: Database, writes: readonly SQLWrapper[]) {
  return writes.map((write, index) =>
    db.$with(`write_${String(index)}`, {}).as(write.getSQL()),
  );
}
