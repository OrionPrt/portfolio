"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";

import {
  deleteMessageAction,
  markMessageReadAction,
  setMessageStatusAction,
} from "@/features/contact/inbox-actions";
import {
  INBOX_IDLE,
  type InboxActionState,
} from "@/features/contact/inbox-state";
import type { MessageStatus } from "@/features/content/vocabulary";

import { ConfirmDialog } from "../confirm-dialog";
import { ADMIN_COPY } from "../copy";
import { FormAlert } from "../form-alert";
import { FormStatus } from "../form-status";
import { SubmitButton } from "../submit-button";

const COPY = ADMIN_COPY.inbox;

function failureOf(state: InboxActionState): string | undefined {
  return state.status === "not_found" || state.status === "unavailable"
    ? COPY.failures[state.status]
    : undefined;
}

interface StatusFormProps {
  readonly id: string;
  readonly status: MessageStatus;
}

/** Read, unread, archive: one form, the button pressed says which. */
function StatusForm({ id, status }: StatusFormProps) {
  const [state, formAction] = useActionState(
    setMessageStatusAction,
    INBOX_IDLE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-3">
        {status !== "archived" && (
          <SubmitButton
            name="status"
            value={status === "unread" ? "read" : "unread"}
            look="secondary"
            pendingLabel={COPY.saving}
          >
            {status === "unread" ? COPY.markRead : COPY.markUnread}
          </SubmitButton>
        )}
        <SubmitButton
          name="status"
          value={status === "archived" ? "read" : "archived"}
          look="secondary"
          pendingLabel={COPY.saving}
        >
          {status === "archived" ? COPY.unarchive : COPY.archive}
        </SubmitButton>
      </div>
      <FormStatus
        message={
          state.status === "changed" ? COPY.changed[state.to] : undefined
        }
      />
      <FormAlert message={failureOf(state)} />
    </form>
  );
}

interface DeleteFormProps {
  readonly id: string;
  readonly cancel: ReactNode;
}

/** Inside the confirmation dialog, which remounts it on each opening. */
function DeleteForm({ id, cancel }: DeleteFormProps) {
  const [state, formAction] = useActionState(deleteMessageAction, INBOX_IDLE);

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

interface MessageActionsProps {
  readonly id: string;
  readonly status: MessageStatus;
}

/**
 * What can be done with an open message (keyed by its id). Opening an unread
 * one marks it read, once shown: a prefetch, which never mounts this, changes
 * nothing, and marking it unread again keeps it unread.
 */
export function MessageActions({ id, status }: MessageActionsProps) {
  const wasUnreadWhenOpened = useRef(status === "unread");
  useEffect(() => {
    if (wasUnreadWhenOpened.current) {
      // Should it fail, the message simply stays unread, as the page shows.
      markMessageReadAction(id).catch(() => undefined);
    }
  }, [id]);

  return (
    <div className="flex flex-wrap items-start gap-3">
      <StatusForm id={id} status={status} />
      <ConfirmDialog
        triggerLabel={COPY.delete.trigger}
        title={COPY.delete.title}
        description={COPY.delete.description}
      >
        {(cancel) => <DeleteForm id={id} cancel={cancel} />}
      </ConfirmDialog>
    </div>
  );
}
