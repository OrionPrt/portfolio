import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { skills } from "@/db/schema";
import type { Database } from "@/db/types";
import {
  reclaimWrite,
  renameWrites,
} from "@/features/content/redirects-repository";
import type {
  ContentStatus,
  EntryCollection,
} from "@/features/content/vocabulary";
import { LOCALES, type Locale } from "@/i18n/locales";

/**
 * Writes an entry's save (a project, an experience) runs alongside its own,
 * as one statement (see `alongside`).
 */

/** A table linking entries to skills, each link with its place. */
export interface SkillLinkTable {
  readonly table: PgTable;
  readonly entryColumn: PgColumn;
  readonly skillColumn: PgColumn;
  readonly placeColumn: PgColumn;
}

function textArray(values: readonly string[]): SQL {
  const items = values.map((value) => sql`${value}`);
  return sql`array[${sql.join(items, sql`, `)}]::text[]`;
}

/**
 * The entry links exactly these skills, in this order: the other links go,
 * these are written with their place. A slug no skill holds (one deleted
 * meanwhile) is passed over.
 */
export function skillLinkWrites(
  { table, entryColumn, skillColumn, placeColumn }: SkillLinkTable,
  entryId: string,
  slugs: readonly string[],
): readonly SQLWrapper[] {
  const chosen = textArray(slugs);
  const name = (column: PgColumn) => sql.identifier(column.name);
  return [
    sql`delete from ${table} where ${entryColumn} = ${entryId}
      and ${skillColumn} not in (select ${skills.id} from ${skills} where ${skills.slug} = any(${chosen}))`,
    sql`insert into ${table} (${name(entryColumn)}, ${name(skillColumn)}, ${name(placeColumn)})
      select ${entryId}::uuid, ${skills.id}, chosen.place - 1
      from unnest(${chosen}) with ordinality as chosen(slug, place)
      join ${skills} on ${skills.slug} = chosen.slug
      on conflict (${name(entryColumn)}, ${name(skillColumn)})
      do update set ${name(placeColumn)} = excluded.${name(placeColumn)}`,
  ];
}

/** On conflict, these columns take the values proposed: a multi-row upsert's `set`. */
export function proposedValues<K extends string>(
  columns: Readonly<Record<K, PgColumn>>,
): Record<K, SQL> {
  return Object.fromEntries(
    Object.entries<PgColumn>(columns).map(([key, column]) => [
      key,
      sql`excluded.${sql.identifier(column.name)}`,
    ]),
  ) as Record<K, SQL>;
}

/** The languages given, each with its values, in the locales' order. */
export function translationEntries<T>(
  translations: Partial<Record<Locale, T | undefined>>,
): readonly (readonly [Locale, T])[] {
  return LOCALES.flatMap((locale) => {
    const values = translations[locale];
    return values === undefined ? [] : [[locale, values] as const];
  });
}

interface Publication {
  readonly slug: string;
  readonly status: ContentStatus;
}

/**
 * What an entry's save does to the redirects. Renamed while published, it
 * leaves one from its old slug; published, its slug is no longer an old one.
 * A draft's slug is not public: renaming it leaves nothing, and a redirect
 * from the slug it takes keeps working until it is published.
 */
export function redirectWrites(
  db: Database,
  collection: EntryCollection,
  before: Publication | undefined,
  after: Publication,
): readonly SQLWrapper[] {
  if (before?.status === "published" && before.slug !== after.slug) {
    return renameWrites(db, collection, before.slug, after.slug);
  }
  return after.status === "published"
    ? [reclaimWrite(db, collection, after.slug)]
    : [];
}
