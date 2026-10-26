"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { BUTTON_CLASSES } from "@/components/ui/button-classes";

import { ADMIN_COPY } from "./copy";

interface ConfirmDialogProps {
  readonly triggerLabel: string;
  readonly title: string;
  readonly description: string;
  /** The confirming form; it gets the cancel button to place next to its submit. */
  readonly children: (cancel: ReactNode) => ReactNode;
}

/**
 * A destructive step behind an explicit confirmation, in a modal <dialog>:
 * the browser traps focus and closes it on Escape. Focus starts on Cancel, so
 * a stray Enter never confirms. Each opening starts a fresh form: an error
 * from a cancelled attempt does not come back.
 */
export function ConfirmDialog({
  triggerLabel,
  title,
  description,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [openings, setOpenings] = useState(0);

  // Once the fresh form is in place: its Cancel button is a new element.
  useEffect(() => {
    if (openings > 0) {
      cancelRef.current?.focus();
    }
  }, [openings]);

  const cancel = (
    <button
      ref={cancelRef}
      type="button"
      onClick={() => dialogRef.current?.close()}
      className={BUTTON_CLASSES.secondary}
    >
      {ADMIN_COPY.cancel}
    </button>
  );

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setOpenings((count) => count + 1);
          dialogRef.current?.showModal();
        }}
        className={BUTTON_CLASSES.dangerQuiet}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="bg-surface text-fg border-line rounded-tile backdrop:bg-ground/80 m-auto w-[min(32rem,calc(100%-2rem))] border p-6 shadow-2xl"
      >
        <div className="flex flex-col gap-4">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p id={descriptionId} className="text-fg-muted leading-relaxed">
            {description}
          </p>
          <div key={openings}>{children(cancel)}</div>
        </div>
      </dialog>
    </>
  );
}
