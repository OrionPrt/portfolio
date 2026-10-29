import { describe, expect, it } from "vitest";

import type { TileKind, TileSize } from "@/features/content/vocabulary";

import { fitsOneScreen, placeTiles, SCREEN_ROWS } from "./placement";

function tiles(
  ...entries: readonly (readonly [TileKind, TileSize])[]
): readonly { kind: TileKind; size: TileSize }[] {
  return entries.map(([kind, size]) => ({ kind, size }));
}

describe("placeTiles", () => {
  it("places the seeded hub on four rows, as the site shows it", () => {
    const { placements, rowCount } = placeTiles(
      tiles(
        ["identity", "xl"],
        ["featured_project", "xl"],
        ["current_experience", "sm"],
        ["stack", "md"],
        ["cyber_stats", "sm"],
        ["certifications", "sm"],
        ["contact", "sm"],
      ),
    );

    expect(rowCount).toBe(4);
    expect(placements).toEqual([
      { kind: "identity", column: 1, row: 1, columns: 2, rows: 2 },
      { kind: "featured_project", column: 3, row: 1, columns: 2, rows: 2 },
      { kind: "current_experience", column: 1, row: 3, columns: 1, rows: 1 },
      { kind: "stack", column: 2, row: 3, columns: 2, rows: 1 },
      { kind: "cyber_stats", column: 4, row: 3, columns: 1, rows: 1 },
      { kind: "certifications", column: 1, row: 4, columns: 1, rows: 1 },
      { kind: "contact", column: 2, row: 4, columns: 1, rows: 1 },
    ]);
  });

  it("fills an earlier hole with a later tile that fits it (dense packing)", () => {
    const { placements, rowCount } = placeTiles(
      tiles(
        ["contact", "sm"],
        ["stack", "xl"],
        ["identity", "xl"],
        ["cyber_stats", "sm"],
      ),
    );

    // The second xl cannot fit beside the first: it opens row 3. The small
    // tile after it goes back up, into the hole left on row 1.
    expect(placements).toContainEqual({
      kind: "identity",
      column: 1,
      row: 3,
      columns: 2,
      rows: 2,
    });
    expect(placements).toContainEqual({
      kind: "cyber_stats",
      column: 4,
      row: 1,
      columns: 1,
      rows: 1,
    });
    expect(rowCount).toBe(4);
  });

  it("stacks a tall tile over two rows of one column", () => {
    const { placements, rowCount } = placeTiles(
      tiles(["identity", "lg"], ["stack", "md"], ["contact", "sm"]),
    );

    expect(placements).toEqual([
      { kind: "identity", column: 1, row: 1, columns: 1, rows: 2 },
      { kind: "stack", column: 2, row: 1, columns: 2, rows: 1 },
      { kind: "contact", column: 4, row: 1, columns: 1, rows: 1 },
    ]);
    expect(rowCount).toBe(2);
  });

  it("counts no row for no tile", () => {
    expect(placeTiles([])).toEqual({ placements: [], rowCount: 0 });
  });
});

describe("fitsOneScreen", () => {
  it(`holds up to ${String(SCREEN_ROWS)} rows`, () => {
    expect(fitsOneScreen(SCREEN_ROWS)).toBe(true);
    expect(fitsOneScreen(SCREEN_ROWS + 1)).toBe(false);
  });
});
