import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { timestamps } from "./columns";
import { localeEnum } from "./enums";

/** One size of an image, as stored and served: WebP. */
export interface MediaVariant {
  readonly width: number;
  readonly height: number;
  readonly url: string;
  readonly bytes: number;
}

/**
 * The images of the library (ADR-0007): each stored once, at up to three
 * widths. An entry that shows one keeps it: deleting it is refused meanwhile.
 */
export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The uploaded file's SHA-256, in hex: the same image is stored once. */
    sha256: text("sha256").notNull().unique(),
    /** The storage prefix of its files ("media/<id>"), removed with it. */
    pathname: text("pathname").notNull().unique(),
    /** The largest variant's size. */
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    /** Each stored size, narrowest first. */
    variants: jsonb("variants").$type<readonly MediaVariant[]>().notNull(),
    ...timestamps,
  },
  (t) => [
    check("media_sha256_format", sql`${t.sha256} ~ '^[0-9a-f]{64}$'`),
    check("media_dimensions_positive", sql`${t.width} > 0 and ${t.height} > 0`),
    check(
      "media_variants_count",
      sql`jsonb_typeof(${t.variants}) = 'array' and jsonb_array_length(${t.variants}) between 1 and 3`,
    ),
  ],
);

/** The alternative text, in each language: both are required. */
export const mediaTranslations = pgTable(
  "media_translations",
  {
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    alt: text("alt").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.mediaId, t.locale] }),
    check("media_translations_alt_not_blank", sql`btrim(${t.alt}) <> ''`),
  ],
);
