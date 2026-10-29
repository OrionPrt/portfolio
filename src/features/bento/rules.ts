// What the admin may do with each tile of the hub. A plain module, free of
// Zod and Drizzle: the bento editor runs it in the browser, the save on the
// server, and both agree.

import {
  TILE_KINDS,
  type TileKind,
  type TileSize,
} from "@/features/content/vocabulary";

/**
 * always: the identity tile holds the page's h1, it is never hidden;
 * optional: shown or hidden at will; coming: its content does not exist yet
 * (the blog, the generated CV), it stays hidden and out of the editor.
 */
export type TileAvailability = "always" | "optional" | "coming";

export interface TileRule {
  /** The sizes its content fits, smallest first. */
  readonly sizes: readonly [TileSize, ...TileSize[]];
  readonly availability: TileAvailability;
}

/** Sizes: sm 1×1, md 2×1, lg 1×2, xl 2×2 on the four-column grid. */
export const TILE_RULES: Readonly<Record<TileKind, TileRule>> = {
  identity: { sizes: ["lg", "xl"], availability: "always" },
  featured_project: { sizes: ["lg", "xl"], availability: "optional" },
  current_experience: { sizes: ["sm", "md", "lg"], availability: "optional" },
  stack: { sizes: ["md", "lg", "xl"], availability: "optional" },
  cyber_stats: { sizes: ["sm", "md"], availability: "optional" },
  latest_post: { sizes: ["sm", "md", "lg"], availability: "coming" },
  certifications: { sizes: ["sm", "md", "lg"], availability: "optional" },
  cv: { sizes: ["sm", "md"], availability: "coming" },
  contact: { sizes: ["sm", "md"], availability: "optional" },
};

export function isEditableTile(kind: TileKind): boolean {
  return TILE_RULES[kind].availability !== "coming";
}

/** The tiles the editor arranges, in the vocabulary's order. */
export const EDITABLE_TILE_KINDS: readonly TileKind[] =
  TILE_KINDS.filter(isEditableTile);

export function allowsSize(kind: TileKind, size: TileSize): boolean {
  return TILE_RULES[kind].sizes.includes(size);
}
