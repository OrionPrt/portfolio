// The form's fields and limits, without Zod: the browser bundle imports them,
// and Zod probes `new Function` when a schema is built, which the CSP reports.

export const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  subject: 150,
  messageMin: 10,
  message: 5000,
} as const;

export const CONTACT_FIELDS = ["name", "email", "subject", "message"] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];

/** Error codes, translated by the form (messages: Contact.errors). */
export type ContactErrorCode =
  "required" | "too_short" | "too_long" | "invalid";

export type ContactFieldErrors = Readonly<
  Partial<Record<ContactField, ContactErrorCode>>
>;
