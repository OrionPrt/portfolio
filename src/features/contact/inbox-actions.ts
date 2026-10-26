"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { runAdmin } from "@/features/admin/run-admin";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { MESSAGE_STATUSES } from "@/features/content/vocabulary";
import { ok } from "@/lib/result";

import { createInboxRepository } from "./inbox-repository";
import type { InboxActionState } from "./inbox-state";

// Each action is a public endpoint: runAdmin checks the session first, then
// the input is parsed. A malformed id reads like an unknown one.

const MESSAGE_ID = z.uuid();
const STATUS_CHANGE = z.object({
  id: MESSAGE_ID,
  status: z.enum(MESSAGE_STATUSES),
});

/** Opening a message reads it (called once the page shows it, never on a prefetch). */
export async function markMessageReadAction(id: string): Promise<void> {
  const parsed = MESSAGE_ID.safeParse(id);
  const outcome = await runAdmin(({ db }) =>
    parsed.success
      ? createInboxRepository(db).markRead(parsed.data)
      : Promise.resolve(ok(undefined)),
  );
  if (outcome.ok && parsed.success) {
    refresh();
  }
}

export async function setMessageStatusAction(
  _previous: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  const parsed = STATUS_CHANGE.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  const outcome = await runAdmin(({ db }) =>
    parsed.success
      ? createInboxRepository(db).setStatus(parsed.data.id, parsed.data.status)
      : Promise.resolve(ok(false)),
  );
  if (!outcome.ok) {
    return { status: "unavailable" };
  }
  if (!outcome.data || !parsed.success) {
    return { status: "not_found" };
  }
  refresh();
  return { status: "changed", to: parsed.data.status };
}

/**
 * Deletes a message for good, after the page's confirmation. The audit log
 * keeps its id only: a deleted message leaves no personal data behind.
 */
export async function deleteMessageAction(
  _previous: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  const parsed = MESSAGE_ID.safeParse(formData.get("id"));
  const outcome = await runAdmin(({ db, actor }) =>
    parsed.success
      ? createInboxRepository(db).deleteAudited(parsed.data, actor)
      : Promise.resolve(ok(false)),
  );
  if (!outcome.ok) {
    return { status: "unavailable" };
  }
  if (!outcome.data) {
    return { status: "not_found" };
  }
  redirect(ADMIN_PATHS.messages);
}
