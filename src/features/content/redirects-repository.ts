import { and, asc, eq, ne, type SQLWrapper } from "drizzle-orm";

import { MAX_SLUGS } from "@/db/limits";
import { runQuery } from "@/db/query";
import { slugRedirects } from "@/db/schema";
import type { Database } from "@/db/types";
import type { Result } from "@/lib/result";

import type { EntryCollection } from "./vocabulary";

export type SlugRedirect = Pick<
  typeof slugRedirects.$inferSelect,
  "collection" | "fromSlug" | "toSlug"
>;

const t = slugRedirects;

/**
 * A slug a published entry takes (again): no longer an old one. A write for
 * the entry's save (see `alongside`).
 */
export function reclaimWrite(
  db: Database,
  collection: EntryCollection,
  slug: string,
): SQLWrapper {
  return db
    .delete(t)
    .where(and(eq(t.collection, collection), eq(t.fromSlug, slug)));
}

/**
 * A published entry renamed from `from` to `to`, as writes for its save:
 * `to` is live again (a redirect from it goes), the redirects that led to
 * `from` now lead to `to` (chains stay flat), and `from` leads to `to`. Each
 * touches its own rows, as one statement needs.
 */
export function renameWrites(
  db: Database,
  collection: EntryCollection,
  from: string,
  to: string,
): readonly SQLWrapper[] {
  return [
    reclaimWrite(db, collection, to),
    db
      .update(t)
      .set({ toSlug: to })
      .where(
        and(
          eq(t.collection, collection),
          eq(t.toSlug, from),
          ne(t.fromSlug, to),
        ),
      ),
    db
      .insert(t)
      .values({ collection, fromSlug: from, toSlug: to })
      .onConflictDoUpdate({
        target: [t.collection, t.fromSlug],
        set: { toSlug: to },
      }),
  ];
}

/** The 301s from the old slugs of renamed published entries (ADR-0007). */
export function createRedirectsRepository(db: Database) {
  return {
    /** Every redirect, for the proxy: bounded like the slugs they lead to. */
    list: (): Promise<Result<readonly SlugRedirect[]>> =>
      runQuery("redirects.read_failed", () =>
        db
          .select({
            collection: t.collection,
            fromSlug: t.fromSlug,
            toSlug: t.toSlug,
          })
          .from(t)
          .orderBy(asc(t.collection), asc(t.fromSlug))
          .limit(MAX_SLUGS),
      ),
  };
}
