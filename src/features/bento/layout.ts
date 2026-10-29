// The hub's layout as the editor holds it: every tile it arranges, in order,
// with a size and whether it shows. A plain module, run in the browser.

import type { TileKind, TileSize } from "@/features/content/vocabulary";

import { allowsSize, EDITABLE_TILE_KINDS, TILE_RULES } from "./rules";

export interface TileSetting {
  readonly kind: TileKind;
  readonly size: TileSize;
  readonly visible: boolean;
}

/** The form's fields: the order once per tile, then a size and a box per tile. */
export const LAYOUT_FIELDS = {
  order: "order",
  size: (kind: TileKind) => `size.${kind}`,
  visible: (kind: TileKind) => `visible.${kind}`,
} as const;

/** What a checked box sends. */
export const CHECKED = "on";

/** A setting the rules allow: a size its content fits, the identity shown. */
function allowed(kind: TileKind, size: TileSize, visible: boolean) {
  const rule = TILE_RULES[kind];
  return {
    kind,
    size: allowsSize(kind, size) ? size : rule.sizes[0],
    visible: rule.availability === "always" || visible,
  };
}

/**
 * The stored tiles the editor arranges, in their order, then those with no
 * row yet: hidden (the hub does not show them), at their smallest size.
 */
export function editableLayout(
  stored: readonly TileSetting[],
): readonly TileSetting[] {
  const kept = stored.filter((tile) => EDITABLE_TILE_KINDS.includes(tile.kind));
  const missing = EDITABLE_TILE_KINDS.filter(
    (kind) => !kept.some((tile) => tile.kind === kind),
  );
  return [
    ...kept.map(({ kind, size, visible }) => allowed(kind, size, visible)),
    ...missing.map((kind) => allowed(kind, TILE_RULES[kind].sizes[0], false)),
  ];
}

type SentValues = Readonly<Record<string, readonly string[]>>;

/**
 * The layout a refused form sent, so the editor shows it again: its order
 * (unknown or repeated tiles dropped, forgotten ones after), sizes and boxes.
 */
export function layoutFromSent(
  sent: SentValues,
  stored: readonly TileSetting[],
): readonly TileSetting[] {
  const storedKinds = stored.map((tile) => tile.kind);
  const sentKinds = (sent[LAYOUT_FIELDS.order] ?? []).flatMap((value) =>
    storedKinds.filter((kind) => kind === value),
  );
  const ordered = [...new Set([...sentKinds, ...storedKinds])].flatMap((kind) =>
    stored.filter((tile) => tile.kind === kind).slice(0, 1),
  );
  return ordered.map(({ kind, size }) => {
    const sentSize = sent[LAYOUT_FIELDS.size(kind)]?.[0];
    const isChecked =
      sent[LAYOUT_FIELDS.visible(kind)]?.includes(CHECKED) ?? false;
    const known = TILE_RULES[kind].sizes.find((option) => option === sentSize);
    return allowed(kind, known ?? size, isChecked);
  });
}
