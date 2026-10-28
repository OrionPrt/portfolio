"use client";

import { useRouter } from "next/navigation";
import { useActionState, useLayoutEffect, useRef, type ReactNode } from "react";

import {
  LIST_IDLE,
  type ListActionState,
} from "@/features/admin/content-form-state";

import { announce } from "../announce";
import { ConfirmDialog } from "../confirm-dialog";
import { ADMIN_COPY } from "../copy";
import { FormAlert } from "../form-alert";
import { FormStatus } from "../form-status";
import { SubmitButton } from "../submit-button";

const COPY = ADMIN_COPY.content;

export type ListAction = (
  state: ListActionState,
  formData: FormData,
) => Promise<ListActionState>;

function failureOf(state: ListActionState): string | undefined {
  switch (state.status) {
    case "not_found":
      return COPY.notFound;
    case "unavailable":
      return COPY.unavailable;
    case "in_use":
      return COPY.delete.inUse;
    default:
      return undefined;
  }
}

interface MoveButtonsProps {
  readonly action: ListAction;
  readonly id: string;
  /** The entry, in words: "Rust" makes "Monter Rust". */
  readonly label: string;
  readonly isFirst: boolean;
  readonly isLast: boolean;
}

/**
 * Up and down, one step. At an end, or while a move is under way, a button
 * stays focusable but does nothing: removing it would drop the focus, and a
 * second click would move the entry twice.
 */
export function MoveButtons({
  action,
  id,
  label,
  isFirst,
  isLast,
}: MoveButtonsProps) {
  const [state, formAction, isPending] = useActionState(action, LIST_IDLE);
  const pressed = useRef<HTMLButtonElement | null>(null);
  // The new order comes with the outcome: when React inserts this row again,
  // the button pressed loses the focus, which goes back to it.
  useLayoutEffect(() => {
    const button = pressed.current;
    pressed.current = null;
    if (button?.isConnected === true && document.activeElement !== button) {
      button.focus();
    }
  }, [state]);
  const button = (direction: "up" | "down", isEnd: boolean, text: string) => {
    const isInert = isEnd || isPending;
    return (
      <button
        type="submit"
        name="direction"
        value={direction}
        aria-disabled={isInert ? true : undefined}
        onClick={(event) => {
          if (isInert) {
            event.preventDefault();
          } else {
            pressed.current = event.currentTarget;
          }
        }}
        className="border-line text-fg-muted hover:text-fg hover:border-fg-muted rounded-control inline-flex size-10 items-center justify-center border aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
      >
        <span aria-hidden="true">{direction === "up" ? "↑" : "↓"}</span>
        <span className="sr-only">{text}</span>
      </button>
    );
  };
  return (
    <form action={formAction} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      {button("up", isFirst, COPY.move.up(label))}
      {button("down", isLast, COPY.move.down(label))}
      <FormStatus
        message={state.status === "done" ? COPY.move.done : undefined}
      />
      <FormAlert message={failureOf(state)} />
    </form>
  );
}

interface DeleteFormProps {
  readonly action: ListAction;
  readonly id: string;
  readonly label: string;
  readonly cancel: ReactNode;
  readonly afterDelete: string | undefined;
}

/**
 * Once deleted, the entry's row, or its page, is gone, this form with it: the
 * outcome is said by the frame's announcer, and focus moves to the page (or
 * the list it returns to), from the action itself, which outlives the form.
 */
function DeleteForm({
  action,
  id,
  label,
  cancel,
  afterDelete,
}: DeleteFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previous: ListActionState, formData: FormData) => {
      const outcome = await action(previous, formData);
      if (outcome.status === "done") {
        announce(COPY.delete.done(label));
        if (afterDelete === undefined) {
          document.getElementById("admin-main")?.focus();
        } else {
          router.push(afterDelete);
        }
      }
      return outcome;
    },
    LIST_IDLE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <FormAlert message={failureOf(state)} />
      <div className="flex flex-wrap justify-end gap-3">
        {cancel}
        <SubmitButton look="danger" pendingLabel={COPY.delete.pending}>
          {COPY.delete.confirm}
        </SubmitButton>
      </div>
    </form>
  );
}

interface DeleteEntryProps {
  readonly action: ListAction;
  readonly id: string;
  /** The entry, in words: "Rust" makes the trigger "Supprimer Rust". */
  readonly label: string;
  /** The question: "Supprimer la compétence « Rust » ?" */
  readonly title: string;
  /** What else goes with it, before the snapshot note. */
  readonly consequence?: string;
  /** From the entry's own page: the list to go back to. */
  readonly afterDelete?: string;
}

/** Deletion for good, behind a confirmation; the audit log keeps a snapshot. */
export function DeleteEntry({
  action,
  id,
  label,
  title,
  consequence,
  afterDelete,
}: DeleteEntryProps) {
  return (
    <ConfirmDialog
      triggerLabel={COPY.delete.trigger}
      triggerContext={label}
      title={title}
      description={[consequence, COPY.delete.snapshot]
        .filter((part) => part !== undefined)
        .join(" ")}
    >
      {(cancel) => (
        <DeleteForm
          action={action}
          id={id}
          label={label}
          cancel={cancel}
          afterDelete={afterDelete}
        />
      )}
    </ConfirmDialog>
  );
}
