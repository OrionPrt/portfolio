import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { MAX_SLUGS } from "@/db/limits";
import type { Database } from "@/db/types";
import { MAX_SLUG_LENGTH } from "@/lib/slug";

/** A small table whose rows each hold a unique slug (education, certifications). */
export interface SlugTable {
  readonly table: PgTable;
  readonly slugColumn: PgColumn;
}

/** The slug with a number, cut so the whole stays within the maximum length. */
function numbered(base: string, number: number): string {
  const suffix = `-${String(number)}`;
  const head = base
    .slice(0, MAX_SLUG_LENGTH - suffix.length)
    .replace(/-+$/, "");
  return `${head}${suffix}`;
}

/** The slug, or the first numbered one no row holds: "insa", "insa-2"... */
export async function freeSlug(
  db: Database,
  { table, slugColumn }: SlugTable,
  base: string,
): Promise<string> {
  const rows = await db
    .select({ slug: slugColumn })
    .from(table)
    .limit(MAX_SLUGS);
  const taken = new Set(rows.map((row) => String(row.slug)));
  let number = 1;
  let slug = base;
  while (taken.has(slug)) {
    number += 1;
    slug = numbered(base, number);
  }
  return slug;
}
