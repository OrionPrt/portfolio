import { describe, expect, it } from "vitest";

import { TILE_KINDS } from "@/features/content/vocabulary";

import { SEED_CONTENT } from "../../../scripts/seed/content";
import {
  CHECKED,
  editableLayout,
  LAYOUT_FIELDS,
  layoutFromSent,
  type TileSetting,
} from "./layout";
import { allowsSize, EDITABLE_TILE_KINDS, TILE_RULES } from "./rules";
import { bentoLayoutSchema } from "./schema";

const STORED: readonly TileSetting[] = [
  { kind: "identity", size: "xl", visible: true },
  { kind: "featured_project", size: "xl", visible: true },
  { kind: "current_experience", size: "sm", visible: true },
  { kind: "stack", size: "md", visible: true },
  { kind: "cyber_stats", size: "sm", visible: false },
  { kind: "latest_post", size: "sm", visible: false },
  { kind: "certifications", size: "sm", visible: true },
  { kind: "contact", size: "sm", visible: true },
];

/** The fields the editor sends for a layout. */
function sent(layout: readonly TileSetting[]) {
  return Object.fromEntries([
    [LAYOUT_FIELDS.order, layout.map((tile) => tile.kind)],
    ...layout.map((tile) => [LAYOUT_FIELDS.size(tile.kind), [tile.size]]),
    ...layout
      .filter((tile) => tile.visible)
      .map((tile) => [LAYOUT_FIELDS.visible(tile.kind), [CHECKED]]),
  ]) as Record<string, readonly string[]>;
}

/** The action's input for a layout. */
function input(layout: readonly TileSetting[]) {
  return {
    order: layout.map((tile) => tile.kind),
    size: Object.fromEntries(layout.map((tile) => [tile.kind, tile.size])),
    visible: Object.fromEntries(
      layout.map((tile) => [tile.kind, tile.visible]),
    ),
  };
}

describe("TILE_RULES", () => {
  it("allows every size the seed gives the tiles", () => {
    for (const tile of SEED_CONTENT.tiles) {
      expect(allowsSize(tile.kind, tile.size ?? "md")).toBe(true);
    }
  });

  it("keeps the CV out of the editor until it exists", () => {
    expect(EDITABLE_TILE_KINDS).toEqual(
      TILE_KINDS.filter((kind) => kind !== "cv"),
    );
    expect(TILE_RULES.identity.availability).toBe("always");
  });
});

describe("editableLayout", () => {
  it("keeps the stored order, and adds the tiles without a row, hidden", () => {
    const layout = editableLayout([
      { kind: "contact", size: "md", visible: true },
      { kind: "cv", size: "sm", visible: false },
      { kind: "identity", size: "xl", visible: true },
    ]);

    expect(layout.slice(0, 2)).toEqual([
      { kind: "contact", size: "md", visible: true },
      { kind: "identity", size: "xl", visible: true },
    ]);
    expect(layout.map((tile) => tile.kind)).toEqual([
      "contact",
      "identity",
      "featured_project",
      "current_experience",
      "stack",
      "cyber_stats",
      "latest_post",
      "certifications",
    ]);
    expect(layout[2]).toEqual({
      kind: "featured_project",
      size: "lg",
      visible: false,
    });
  });

  it("brings a stored size the content does not fit back to the smallest it does, and shows the identity", () => {
    const layout = editableLayout([
      { kind: "identity", size: "sm", visible: false },
    ]);

    expect(layout[0]).toEqual({ kind: "identity", size: "lg", visible: true });
  });
});

describe("layoutFromSent", () => {
  it("restores what a refused form sent", () => {
    const changed: readonly TileSetting[] = [
      { kind: "stack", size: "xl", visible: true },
      ...STORED.filter((tile) => tile.kind !== "stack").map((tile) => ({
        ...tile,
        visible: tile.kind === "identity",
      })),
    ];

    expect(layoutFromSent(sent(changed), STORED)).toEqual(changed);
  });

  it("drops unknown and repeated tiles, puts forgotten ones last, and ignores sizes not offered", () => {
    const values = {
      ...sent(STORED),
      [LAYOUT_FIELDS.order]: ["contact", "nope", "contact", "identity"],
      [LAYOUT_FIELDS.size("contact")]: ["xl"],
    };

    const layout = layoutFromSent(values, STORED);

    expect(layout.map((tile) => tile.kind)).toEqual([
      "contact",
      "identity",
      "featured_project",
      "current_experience",
      "stack",
      "cyber_stats",
      "latest_post",
      "certifications",
    ]);
    expect(layout[0]?.size).toBe("sm");
  });
});

describe("bentoLayoutSchema", () => {
  it("gives the tiles in the order sent", () => {
    const parsed = bentoLayoutSchema.safeParse(input(STORED));

    expect(parsed.success && parsed.data).toEqual(STORED);
  });

  it("refuses a size the tile's content does not fit, under the field's name", () => {
    const parsed = bentoLayoutSchema.safeParse({
      ...input(STORED),
      size: { ...input(STORED).size, contact: "xl" },
    });

    expect(parsed.error?.issues.map((issue) => issue.path)).toEqual([
      ["size", "contact"],
    ]);
  });

  it("refuses a hidden identity tile", () => {
    const parsed = bentoLayoutSchema.safeParse({
      ...input(STORED),
      visible: { ...input(STORED).visible, identity: false },
    });

    expect(parsed.error?.issues.map((issue) => issue.path)).toEqual([
      ["visible", "identity"],
    ]);
  });

  it.each([
    ["a missing tile", STORED.slice(1).map((tile) => tile.kind)],
    [
      "a repeated tile",
      [...STORED.slice(1).map((tile) => tile.kind), "contact"],
    ],
    ["a tile not built yet", [...STORED.map((tile) => tile.kind), "cv"]],
  ])("refuses an order with %s", (_case, order) => {
    expect(
      bentoLayoutSchema.safeParse({ ...input(STORED), order }).success,
    ).toBe(false);
  });

  it("refuses a layout without a tile's size", () => {
    const size = Object.fromEntries(
      Object.entries(input(STORED).size).filter(([kind]) => kind !== "contact"),
    );

    expect(
      bentoLayoutSchema.safeParse({ ...input(STORED), size }).success,
    ).toBe(false);
  });
});
