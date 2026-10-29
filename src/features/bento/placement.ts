// Where each tile lands on the hub's four-column grid, as the browser places
// it there: the editor's preview draws it, and counts the rows. A plain
// module, run in the browser.

import type { TileKind, TileSize } from "@/features/content/vocabulary";

/** The hub's columns from 1024 px (BentoGrid). */
export const GRID_COLUMNS = 4;

/** The rows that share a 1280×720 screen: past them, the hub scrolls. */
export const SCREEN_ROWS = 4;

interface Span {
  readonly columns: number;
  readonly rows: number;
}

/** The spans of Tile's size classes, on the four-column grid. */
export const TILE_SPANS: Readonly<Record<TileSize, Span>> = {
  sm: { columns: 1, rows: 1 },
  md: { columns: 2, rows: 1 },
  lg: { columns: 1, rows: 2 },
  xl: { columns: 2, rows: 2 },
};

export interface PlacedTile extends Span {
  readonly kind: TileKind;
  /** Grid lines, from 1. */
  readonly column: number;
  readonly row: number;
}

export interface Placement {
  readonly placements: readonly PlacedTile[];
  readonly rowCount: number;
}

function overlaps(a: PlacedTile, b: PlacedTile): boolean {
  return (
    a.column < b.column + b.columns &&
    b.column < a.column + a.columns &&
    a.row < b.row + b.rows &&
    b.row < a.row + a.rows
  );
}

/**
 * The first free area from the grid's start, row by row: CSS Grid's dense
 * auto-placement (`grid-auto-flow: row dense`), which BentoGrid uses so a
 * later tile fills a hole an earlier one left.
 */
function placeOne(
  placed: readonly PlacedTile[],
  kind: TileKind,
  size: TileSize,
): PlacedTile {
  const span = TILE_SPANS[size];
  // Below every placed tile, the area is always free.
  const lastRow = placed.reduce(
    (bottom, tile) => Math.max(bottom, tile.row + tile.rows),
    1,
  );
  for (let row = 1; row < lastRow; row += 1) {
    for (
      let column = 1;
      column + span.columns - 1 <= GRID_COLUMNS;
      column += 1
    ) {
      const candidate = { kind, column, row, ...span };
      if (!placed.some((tile) => overlaps(tile, candidate))) {
        return candidate;
      }
    }
  }
  return { kind, column: 1, row: lastRow, ...span };
}

/** The tiles shown, in order: where each lands, and how many rows they take. */
export function placeTiles(
  tiles: readonly { readonly kind: TileKind; readonly size: TileSize }[],
): Placement {
  const placements = tiles.reduce<readonly PlacedTile[]>(
    (placed, { kind, size }) => [...placed, placeOne(placed, kind, size)],
    [],
  );
  const rowCount = placements.reduce(
    (bottom, tile) => Math.max(bottom, tile.row + tile.rows - 1),
    0,
  );
  return { placements, rowCount };
}

export function fitsOneScreen(rowCount: number): boolean {
  return rowCount <= SCREEN_ROWS;
}
