/**
 * The rows of a raw `db.execute`, whatever the driver: postgres.js returns
 * them as the result itself, Neon over HTTP and PGlite under `.rows`.
 */
export function rowsOf(result: unknown): readonly unknown[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (
    typeof result === "object" &&
    result !== null &&
    "rows" in result &&
    Array.isArray(result.rows)
  ) {
    return result.rows;
  }
  throw new Error("Unexpected query result shape");
}
