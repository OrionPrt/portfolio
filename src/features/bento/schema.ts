import { z } from "zod";

import { TILE_SIZES, type TileKind } from "@/features/content/vocabulary";

import type { TileSetting } from "./layout";
import { allowsSize, EDITABLE_TILE_KINDS, TILE_RULES } from "./rules";

const editableKind = z.enum(EDITABLE_TILE_KINDS);

function holdsEveryTileOnce(order: readonly TileKind[]): boolean {
  return (
    order.length === EDITABLE_TILE_KINDS.length &&
    EDITABLE_TILE_KINDS.every((kind) => order.includes(kind))
  );
}

/**
 * The layout the editor sends: every tile it arranges once, in order, each
 * at a size its content fits; the identity shown. Problems come back under
 * the form's names (`size.stack`). Out: the tiles in order.
 */
export const bentoLayoutSchema = z
  .object({
    order: z
      .array(editableKind)
      .max(EDITABLE_TILE_KINDS.length)
      .refine(holdsEveryTileOnce),
    size: z.record(editableKind, z.enum(TILE_SIZES)),
    visible: z.record(editableKind, z.boolean()),
  })
  .superRefine(({ size, visible }, context) => {
    for (const kind of EDITABLE_TILE_KINDS) {
      if (!allowsSize(kind, size[kind])) {
        context.addIssue({ code: "custom", path: ["size", kind] });
      }
      if (TILE_RULES[kind].availability === "always" && !visible[kind]) {
        context.addIssue({ code: "custom", path: ["visible", kind] });
      }
    }
  })
  .transform(({ order, size, visible }): readonly TileSetting[] =>
    order.map((kind) => ({ kind, size: size[kind], visible: visible[kind] })),
  );
