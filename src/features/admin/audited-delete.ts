import { sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { runQuery } from "@/db/query";
import { rowsOf } from "@/db/rows";
import { auditLogs, slugRedirects } from "@/db/schema";
import type { Database } from "@/db/types";
import type { AuditActor } from "@/features/auth/audit-repository";
import type { EntryCollection } from "@/features/content/vocabulary";
import type { Result } from "@/lib/result";

import type { ContentEntity } from "./content-tags";

export interface SnapshotTarget {
  readonly table: PgTable;
  /** The table's uuid primary key. */
  readonly idColumn: PgColumn;
  readonly id: string;
  readonly entity: ContentEntity;
  /** Rows deleted along with it (on delete cascade), kept in the snapshot under their key. */
  readonly related?: readonly RelatedRows[];
  /** An entry with a page of its own: the redirects to its slug go with it. */
  readonly collection?: EntryCollection;
}

export interface RelatedRows {
  /** The snapshot's key for them: "translations", "projectLinks"… */
  readonly key: string;
  readonly table: PgTable;
  readonly foreignKey: PgColumn;
}

/** What a deletion reports: the slug the entry had, if it had one. */
export interface DeletedEntry {
  readonly slug: string | undefined;
}

/** `'key', (its rows as a JSON array)` pairs for jsonb_build_object. */
function relatedPairs(related: readonly RelatedRows[], deletedId: SQL) {
  return related.map(
    ({ key, table, foreignKey }) =>
      sql`, ${key}::text, coalesce((select jsonb_agg(to_jsonb(${table})) from ${table} where ${foreignKey} = ${deletedId}), '[]'::jsonb)`,
  );
}

/** The redirects that led to the deleted entry, as a write of the statement. */
function forgottenRedirects(collection: EntryCollection | undefined) {
  return collection === undefined
    ? sql``
    : sql`, forgotten as (
        delete from ${slugRedirects} where ${slugRedirects.collection} = ${collection}
          and ${slugRedirects.toSlug} in (select deleted.slug from deleted)
      )`;
}

/**
 * Deletes a content row for good and writes its snapshot (the row, and the
 * rows its cascade deletes) to the audit log, in one statement: the deletion
 * is never left unrecorded, and the content can be put back by hand. The
 * statement reads the related rows before the cascade runs. Undefined when
 * there was no such row.
 */
export function deleteWithSnapshot(
  db: Database,
  { table, idColumn, id, entity, related = [], collection }: SnapshotTarget,
  actor: AuditActor,
): Promise<Result<DeletedEntry | undefined>> {
  const deletedId = sql`deleted.${sql.identifier(idColumn.name)}`;
  return runQuery("admin.delete_failed", async () => {
    const result = await db.execute(sql`
      with deleted as (
        delete from ${table} where ${idColumn} = ${id}::uuid returning *
      )${forgottenRedirects(collection)}
      insert into ${auditLogs} (actor_id, action, entity, entity_id, diff, ip_hash, user_agent)
      select ${actor.actorId}::uuid, ${"content.deleted"}, ${entity}, ${deletedId}::text,
        jsonb_build_object('row', to_jsonb(deleted)${sql.join(relatedPairs(related, deletedId))}),
        ${actor.ipHash}, ${actor.userAgent}
      from deleted
      returning ${auditLogs.diff} -> 'row' ->> 'slug' as slug
    `);
    const [row] = rowsOf(result) as readonly { slug: string | null }[];
    return row === undefined ? undefined : { slug: row.slug ?? undefined };
  });
}
