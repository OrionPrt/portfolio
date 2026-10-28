"use client";

import { useId, useRef, useState } from "react";

import { BUTTON_CLASSES } from "@/components/ui/button-classes";
import { CONTROL_CLASSES } from "@/components/ui/form-field";
import type { MediaOption } from "@/features/media/types";

import { ADMIN_COPY } from "../copy";

const COPY = ADMIN_COPY.content.markdown;

interface MarkdownImageInserterProps {
  readonly options: readonly MediaOption[];
  /** Tells same-named controls apart for screen readers: "français". */
  readonly context: string;
  readonly onInsert: (option: MediaOption) => void;
}

/** "Insérer une image": a panel to pick one of the library's, then insert it. */
export function MarkdownImageInserter({
  options,
  context,
  onInsert,
}: MarkdownImageInserterProps) {
  const [isOpen, setOpen] = useState(false);
  const panelId = useId();
  const selectId = useId();
  const hintId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => {
          setOpen(!isOpen);
        }}
        className="rounded-chip text-fg-muted hover:text-fg min-h-8 px-2 text-xs font-medium"
      >
        {COPY.insertImage} <span className="sr-only">{context}</span>
      </button>
      <div
        id={panelId}
        hidden={!isOpen}
        // Escape closes it, the focus back on its button.
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            toggleRef.current?.focus();
          }
        }}
        className="border-line bg-surface-muted rounded-control flex w-full flex-col gap-3 border p-3"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={selectId} className="text-sm font-medium">
              {COPY.imageToInsert} <span className="sr-only">{context}</span>
            </label>
            <select
              ref={selectRef}
              id={selectId}
              aria-describedby={hintId}
              // Choosing is not writing: only the insertion changes the text.
              onInput={(event) => {
                event.stopPropagation();
              }}
              className={CONTROL_CLASSES}
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.alt}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              const chosen = options.find(
                (option) => option.id === selectRef.current?.value,
              );
              if (chosen !== undefined) {
                setOpen(false);
                onInsert(chosen);
              }
            }}
            className={BUTTON_CLASSES.secondary}
          >
            {COPY.insert} <span className="sr-only">{context}</span>
          </button>
        </div>
        <p id={hintId} className="text-fg-muted text-xs">
          {COPY.insertHint}
        </p>
      </div>
    </>
  );
}
