"use client";

import { useId, useState } from "react";
import { flushSync } from "react-dom";

import { CONTROL_CLASSES } from "@/components/ui/form-field";
import { moveItem, type Direction } from "@/features/admin/ordering";
import { saveBentoLayoutAction } from "@/features/bento/admin-actions";
import {
  CHECKED,
  LAYOUT_FIELDS,
  layoutFromSent,
  type TileSetting,
} from "@/features/bento/layout";
import { placeTiles, SCREEN_ROWS } from "@/features/bento/placement";
import { TILE_RULES } from "@/features/bento/rules";
import type { TileKind } from "@/features/content/vocabulary";

import { announce } from "../announce";
import { ADMIN_COPY } from "../copy";
import { BentoPreview } from "./bento-preview";
import { ContentForm, useMarkEdited, useSentValues } from "./content-form";

const COPY = ADMIN_COPY.bento;
const MOVE = ADMIN_COPY.content.move;
const EMPTY: Partial<Record<TileKind, string>> = COPY.empty;

const ICON_BUTTON =
  "border-line text-fg-muted hover:text-fg hover:border-fg-muted aria-disabled:hover:text-fg-muted aria-disabled:hover:border-line rounded-control inline-flex size-9 items-center justify-center border aria-disabled:cursor-not-allowed aria-disabled:opacity-40";

/** Why the tile shows whatever is chosen, or why it never does. */
function noteOf(kind: TileKind, isEmpty: boolean): string | undefined {
  if (TILE_RULES[kind].availability === "always") {
    return COPY.alwaysVisible;
  }
  const empty = EMPTY[kind];
  return isEmpty && empty !== undefined
    ? `${empty}${COPY.emptyEffect}`
    : undefined;
}

/** The tiles the site shows: visible, with something to show. */
function shownOf(
  tiles: readonly TileSetting[],
  emptyKinds: readonly TileKind[],
): readonly TileSetting[] {
  return tiles.filter(
    (tile) => tile.visible && !emptyKinds.includes(tile.kind),
  );
}

/**
 * The tiles in order, and what changes them. Each change shows at once
 * (flushSync), so a moved row keeps the focus on its button; it is said
 * aloud with the hub's new height when that changes, and a move counts as
 * unsaved (a size or a box counts through the form's input event).
 */
function useTileLayout(
  layout: readonly TileSetting[],
  emptyKinds: readonly TileKind[],
) {
  const sent = useSentValues();
  const markEdited = useMarkEdited();
  const [tiles, setTiles] = useState(() =>
    sent === undefined ? layout : layoutFromSent(sent, layout),
  );
  const apply = (next: readonly TileSetting[], message?: string) => {
    const before = placeTiles(shownOf(tiles, emptyKinds)).rowCount;
    const after = placeTiles(shownOf(next, emptyKinds)).rowCount;
    flushSync(() => {
      setTiles(next);
    });
    const said = [
      message,
      before === after ? undefined : COPY.rows(after, SCREEN_ROWS),
    ].filter((part) => part !== undefined);
    if (said.length > 0) {
      announce(said.join(" "));
    }
  };
  const change = (kind: TileKind, values: Partial<TileSetting>) => {
    apply(
      tiles.map((tile) => (tile.kind === kind ? { ...tile, ...values } : tile)),
    );
  };
  const move = (kind: TileKind, direction: Direction) => {
    const order = moveItem(
      tiles.map((tile) => tile.kind),
      kind,
      direction,
    );
    if (order === undefined) {
      return;
    }
    // React moves a row by inserting it again: the button pressed would lose the focus.
    const pressed = document.activeElement;
    apply(
      order.flatMap((next) => tiles.filter((tile) => tile.kind === next)),
      COPY.moved(COPY.names[kind], order.indexOf(kind) + 1, order.length),
    );
    markEdited();
    if (pressed instanceof HTMLElement && pressed !== document.activeElement) {
      pressed.focus();
    }
  };
  return { tiles, change, move };
}

interface MoveButtonsProps {
  readonly name: string;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly onMove: (direction: Direction) => void;
}

/** At an end, a button stays focusable but does nothing: focus is never dropped. */
function MoveButtons({ name, isFirst, isLast, onMove }: MoveButtonsProps) {
  const button = (
    direction: Direction,
    isEnd: boolean,
    label: string,
    icon: string,
  ) => (
    <button
      type="button"
      aria-disabled={isEnd ? true : undefined}
      onClick={() => {
        if (!isEnd) {
          onMove(direction);
        }
      }}
      className={ICON_BUTTON}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
  const tile = COPY.tile(name);
  return (
    <div className="flex gap-2">
      {button("up", isFirst, MOVE.up(tile), "↑")}
      {button("down", isLast, MOVE.down(tile), "↓")}
    </div>
  );
}

interface FieldProps {
  readonly tile: TileSetting;
  readonly name: string;
  readonly onChange: (change: Partial<TileSetting>) => void;
}

/**
 * Uncontrolled, as every admin field: React resets the form after each save,
 * which would bring a controlled value back to its first option. Nor does the
 * browser restore it on reload (autocomplete off): the preview would not follow.
 */
function SizeSelect({ tile, name, onChange }: FieldProps) {
  const id = useId();
  const { sizes } = TILE_RULES[tile.kind];
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm">
        {COPY.size} <span className="sr-only">({name})</span>
      </label>
      <select
        id={id}
        name={LAYOUT_FIELDS.size(tile.kind)}
        defaultValue={tile.size}
        autoComplete="off"
        onChange={(event) => {
          const size = sizes.find((option) => option === event.target.value);
          if (size !== undefined) {
            onChange({ size });
          }
        }}
        className={`${CONTROL_CLASSES} w-36 py-1.5 text-sm`}
      >
        {sizes.map((size) => (
          <option key={size} value={size}>
            {COPY.sizes[size]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The identity always shows: it sends so, with no box to untick. */
function VisibilityBox({
  tile,
  name,
  noteId,
  onChange,
}: FieldProps & { readonly noteId: string | undefined }) {
  if (TILE_RULES[tile.kind].availability === "always") {
    return (
      <input
        type="hidden"
        name={LAYOUT_FIELDS.visible(tile.kind)}
        value={CHECKED}
      />
    );
  }
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={LAYOUT_FIELDS.visible(tile.kind)}
        defaultChecked={tile.visible}
        autoComplete="off"
        aria-describedby={noteId}
        onChange={(event) => {
          onChange({ visible: event.target.checked });
        }}
        className="size-4"
      />
      {COPY.visible} <span className="sr-only">({name})</span>
    </label>
  );
}

interface TileRowProps {
  readonly tile: TileSetting;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly isEmpty: boolean;
  readonly onMove: (direction: Direction) => void;
  readonly onChange: (change: Partial<TileSetting>) => void;
}

/** One tile: its place, its size among those its content fits, whether it shows. */
function TileRow({ tile, isEmpty, onChange, ...moves }: TileRowProps) {
  const noteId = useId();
  const name = COPY.names[tile.kind];
  const note = noteOf(tile.kind, isEmpty);
  return (
    // The same columns on every row: sizes and boxes line up.
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 md:grid-cols-[minmax(0,1fr)_5rem_12.5rem_6rem]">
      <span className="font-medium">{name}</span>
      <MoveButtons name={name} {...moves} />
      <SizeSelect tile={tile} name={name} onChange={onChange} />
      <VisibilityBox
        tile={tile}
        name={name}
        noteId={note === undefined ? undefined : noteId}
        onChange={onChange}
      />
      {note !== undefined && (
        <p id={noteId} className="text-fg-muted col-span-full text-xs">
          {note}
        </p>
      )}
    </li>
  );
}

interface BentoEditorProps {
  /** Every tile the editor arranges, as stored. */
  readonly layout: readonly TileSetting[];
  /** Tiles with nothing to show: the site leaves them out, shown or not. */
  readonly emptyKinds: readonly TileKind[];
}

/** The tiles in order, each with its size and box; beside them, the hub they make. */
function BentoEditor({ layout, emptyKinds }: BentoEditorProps) {
  const { tiles, change, move } = useTileLayout(layout, emptyKinds);
  const hintId = useId();
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
      <fieldset
        aria-describedby={hintId}
        className="flex min-w-0 flex-col gap-3"
      >
        <legend className="mb-2">
          <h2 className="text-lg font-semibold tracking-tight">{COPY.tiles}</h2>
        </legend>
        <p id={hintId} className="text-fg-muted text-xs">
          {COPY.hint}
        </p>
        {/* role="list": Safari drops list semantics once list-style is none. */}
        <ol role="list" className="divide-line divide-y">
          {tiles.map((tile, index) => (
            <TileRow
              key={tile.kind}
              tile={tile}
              isFirst={index === 0}
              isLast={index === tiles.length - 1}
              isEmpty={emptyKinds.includes(tile.kind)}
              onMove={(direction) => {
                move(tile.kind, direction);
              }}
              onChange={(values) => {
                change(tile.kind, values);
              }}
            />
          ))}
        </ol>
        {tiles.map((tile) => (
          <input
            key={tile.kind}
            type="hidden"
            name={LAYOUT_FIELDS.order}
            value={tile.kind}
          />
        ))}
        <p className="text-fg-muted text-xs">{COPY.coming}</p>
      </fieldset>
      <div className="max-w-sm xl:sticky xl:top-8">
        <BentoPreview shown={shownOf(tiles, emptyKinds)} />
      </div>
    </div>
  );
}

/** The layout as one value: a new one, once saved, remounts the editor on it. */
function versionOf(layout: readonly TileSetting[]): string {
  return layout
    .map(({ kind, size, visible }) => `${kind}:${size}:${String(visible)}`)
    .join(",");
}

/** The hub's layout, saved whole. */
export function BentoForm(props: BentoEditorProps) {
  return (
    <ContentForm action={saveBentoLayoutAction} saveNote={COPY.saveNote}>
      <BentoEditor key={versionOf(props.layout)} {...props} />
    </ContentForm>
  );
}
