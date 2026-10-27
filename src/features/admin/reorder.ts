import { sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import type { Database } from "@/db/types";

/** A table whose rows keep a place of their own: its uuid key and that place. */
export interface OrderedTable {
  readonly table: PgTable;
  readonly idColumn: PgColumn;
  readonly placeColumn: PgColumn;
}

/** Each row takes its place in the list given, in one statement: never half reordered. */
export async function reorderRows(
  db: Database,
  { table, idColumn, placeColumn }: OrderedTable,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const list = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );
  await db.execute(sql`
    update ${table} set ${sql.identifier(placeColumn.name)} = ordered.place - 1
    from unnest(array[${list}]::uuid[]) with ordinality as ordered(id, place)
    where ${idColumn} = ordered.id
  `);
}
