import type { MessageStatus } from "@/features/content/vocabulary";

// Shared by the inbox's forms and its server actions: keep it free of server code.

export type InboxActionState =
  | { readonly status: "idle" }
  /** The message's new status, announced to assistive technologies. */
  | { readonly status: "changed"; readonly to: MessageStatus }
  | { readonly status: "not_found" | "unavailable" };

export const INBOX_IDLE: InboxActionState = { status: "idle" };
