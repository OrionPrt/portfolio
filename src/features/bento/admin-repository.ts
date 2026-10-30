import { asc } from "drizzle-orm";

import { runQuery } from "@/db/query";
import { bentoTiles } from "@/db/schema";
import type { Database } from "@/db/types";
import { proposedValues } from "@/features/admin/entry-writes";
import type { SaveOutcome } from "@/features/admin/save-content";
import { TILE_KINDS } from "@/features/content/vocabulary";
import type { Result } from "@/lib/result";

import { editableLayout, type TileSetting } from "./layout";

/** One row per kind (unique column): the vocabulary bounds the layout. */
const MAX_TILES = TILE_KINDS.length;

/** The layout is one record: the audit log names it so. */
export const LAYOUT_ID = "layout";

/** What the audit log keeps of a layout: "identity:xl, stack:md:hidden…". */
function described(layout: readonly TileSetting[]): string {
  return layout
    .map(({ kind, size, visible }) =>
      [kind, size, ...(visible ? [] : ["hidden"])].join(":"),
    )
    .join(", ");
}

export function createBentoAdminRepository(db: Database) {
  return {
    /** Every tile the editor arranges, in the hub's order. */
    layout: (): Promise<Result<readonly TileSetting[]>> =>
      runQuery("bento.admin_read_failed", async () => {
        const rows = await db
          .select({
            kind: bentoTiles.kind,
            size: bentoTiles.size,
            visible: bentoTiles.visible,
          })
          .from(bentoTiles)
          .orderBy(asc(bentoTiles.sortOrder), asc(bentoTiles.kind))
          .limit(MAX_TILES);
        return editableLayout(rows);
      }),

    /**
     * The tiles in their new order, in one statement. Those not built yet
     * (the CV) keep their row: they stay hidden.
     */
    save: (layout: readonly TileSetting[]): Promise<Result<SaveOutcome>> =>
      runQuery("bento.admin_write_failed", async () => {
        await db
          .insert(bentoTiles)
          .values(layout.map((tile, place) => ({ ...tile, sortOrder: place })))
          .onConflictDoUpdate({
            target: bentoTiles.kind,
            set: proposedValues({
              size: bentoTiles.size,
              sortOrder: bentoTiles.sortOrder,
              visible: bentoTiles.visible,
            }),
          });
        return {
          status: "saved",
          id: LAYOUT_ID,
          isNew: false,
          diff: { tiles: described(layout) },
        } as const;
      }),
  };
}
