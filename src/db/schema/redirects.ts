import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { slugFormat } from "./columns";
import { entryCollectionEnum } from "./enums";

/**
 * The old slugs of renamed published entries, each with the slug it now leads
 * to: the proxy answers 301 from one to the other (ADR-0007). A chain is kept
 * flat (A→C, never A→B→C), and a slug taken again by a live entry is dropped.
 */
export const slugRedirects = pgTable(
  "slug_redirects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collection: entryCollectionEnum("collection").notNull(),
    fromSlug: text("from_slug").notNull(),
    toSlug: text("to_slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("slug_redirects_from_idx").on(t.collection, t.fromSlug),
    index("slug_redirects_to_idx").on(t.collection, t.toSlug),
    check("slug_redirects_from_slug_format", slugFormat(t.fromSlug)),
    check("slug_redirects_to_slug_format", slugFormat(t.toSlug)),
    check("slug_redirects_not_to_itself", sql`${t.fromSlug} <> ${t.toSlug}`),
  ],
);
