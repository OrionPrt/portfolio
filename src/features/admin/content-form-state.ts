import type { FieldProblem } from "./form-input";

// Shared by the content forms and their server actions: keep it free of server code.

/**
 * What a content save says. No values come back: the form keeps what it sent
 * (refused), or the page shows what was stored (saved, the page refreshes).
 */
export type ContentFormState =
  | { readonly status: "idle" | "saved" | "not_found" | "full" | "unavailable" }
  | {
      readonly status: "invalid";
      readonly problems: Readonly<Record<string, FieldProblem>>;
    };

export const CONTENT_IDLE: ContentFormState = { status: "idle" };

/** A content form's server action. */
export type ContentAction = (
  state: ContentFormState,
  formData: FormData,
) => Promise<ContentFormState>;

/** A list action (move, delete): only its outcome. */
export type ListActionState =
  | { readonly status: "idle" | "done" }
  | { readonly status: "not_found" | "unavailable" };

export const LIST_IDLE: ListActionState = { status: "idle" };
