import { useId } from "react";

import type { TileKind, TileSize } from "@/features/content/vocabulary";
import {
  fitsOneScreen,
  placeTiles,
  SCREEN_ROWS,
  type PlacedTile,
} from "@/features/bento/placement";

import { ADMIN_COPY } from "../copy";

const COPY = ADMIN_COPY.bento;

// The miniature's grid, in rem: the screen's edge is drawn from the same values.
const ROW_HEIGHT = 2.75;
const GAP = 0.375;
const PADDING = 0.375;

/** Halfway through the gap below the last row a 1280×720 screen shows. */
const SCREEN_EDGE =
  PADDING + SCREEN_ROWS * ROW_HEIGHT + (SCREEN_ROWS - 0.5) * GAP;

function isBelowScreen(tile: PlacedTile): boolean {
  return tile.row + tile.rows - 1 > SCREEN_ROWS;
}

function MiniTile({ tile }: { readonly tile: PlacedTile }) {
  const tone = isBelowScreen(tile)
    ? "border-dashed border-fg-muted/50 text-fg-muted"
    : tile.kind === "identity"
      ? "border-accent/70 bg-surface"
      : "border-line bg-surface";
  return (
    <div
      style={{
        gridColumn: `${String(tile.column)} / span ${String(tile.columns)}`,
        gridRow: `${String(tile.row)} / span ${String(tile.rows)}`,
      }}
      className={`rounded-chip min-w-0 overflow-hidden border px-1.5 py-1 text-[0.6875rem] leading-tight font-medium break-words hyphens-auto ${tone}`}
    >
      {COPY.shortNames[tile.kind]}
    </div>
  );
}

interface BentoPreviewProps {
  /** The tiles the site shows, in order: visible, with something to show. */
  readonly shown: readonly {
    readonly kind: TileKind;
    readonly size: TileSize;
  }[];
}

/**
 * The hub as a large screen lays it out, drawn from the same placement as
 * the browser's: the rows it takes, and where a 1280×720 screen ends. The
 * drawing is left to the eyes; its row count is text, said by the editor
 * when a change alters it.
 */
export function BentoPreview({ shown }: BentoPreviewProps) {
  const captionId = useId();
  const { placements, rowCount } = placeTiles(shown);
  const fits = fitsOneScreen(rowCount);
  return (
    // Named outright: not every tool names a figure by its caption.
    <figure aria-labelledby={captionId} className="flex flex-col gap-3">
      <figcaption id={captionId}>
        <h2 className="text-lg font-semibold tracking-tight">{COPY.preview}</h2>
      </figcaption>
      <div
        aria-hidden="true"
        style={{
          gridAutoRows: `${String(ROW_HEIGHT)}rem`,
          gap: `${String(GAP)}rem`,
          padding: `${String(PADDING)}rem`,
        }}
        className="bg-ground border-line rounded-control relative grid grid-cols-4 border"
      >
        {placements.map((tile) => (
          <MiniTile key={tile.kind} tile={tile} />
        ))}
        {!fits && (
          <div
            style={{ top: `${String(SCREEN_EDGE)}rem` }}
            className="border-danger pointer-events-none absolute inset-x-0 border-t-2 border-dashed"
          >
            <span className="bg-ground text-danger absolute right-2 -translate-y-1/2 px-1 font-mono text-[0.625rem]">
              {COPY.screenEdge}
            </span>
          </div>
        )}
      </div>
      {/* Not a live region: the editor says the new height with each change. */}
      <p
        className={
          fits ? "text-fg-muted text-sm" : "text-danger text-sm font-medium"
        }
      >
        {COPY.rows(rowCount, SCREEN_ROWS)}
      </p>
    </figure>
  );
}
