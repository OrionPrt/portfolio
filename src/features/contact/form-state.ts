import {
  CONTACT_FIELDS,
  type ContactField,
  type ContactFieldErrors,
} from "./fields";

// Shared by the server action and the form: keep it free of server code.

/** Field names of the parts of the form that are not the message itself. */
// Not "website" or "url": password managers fill those, and a real message
// would be dropped.
export const HONEYPOT_FIELD = "contact_ref";
export const TURNSTILE_FIELD = "cf-turnstile-response";

/** The action the widget is rendered with, checked on its token. */
export const TURNSTILE_ACTION = "contact";

export type ContactErrorReason = "captcha" | "rate_limited" | "unavailable";

/**
 * The text typed in each field, sent back with a refusal: React empties the
 * form once its action settles, and these refill it.
 */
export type ContactValues = Readonly<Record<ContactField, string>>;

/** What the form shows after a submission; never more than the UI renders. */
export type ContactFormState =
  | { readonly status: "idle" }
  | { readonly status: "sent" }
  | {
      readonly status: "invalid";
      readonly errors: ContactFieldErrors;
      readonly values: ContactValues;
    }
  | {
      readonly status: "failed";
      readonly reason: ContactErrorReason;
      readonly values: ContactValues;
    };

export const INITIAL_CONTACT_STATE: ContactFormState = { status: "idle" };

/** The text of each field, from the posted form; anything else is dropped. */
export function contactValuesOf(
  fields: Readonly<Record<string, unknown>>,
): ContactValues {
  return Object.fromEntries(
    CONTACT_FIELDS.map((name) => {
      const value = fields[name];
      return [name, typeof value === "string" ? value : ""];
    }),
  ) as Record<ContactField, string>;
}
