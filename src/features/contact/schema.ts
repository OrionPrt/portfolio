import "server-only";

import { z } from "zod";

import { err, ok, type Result } from "@/lib/result";

import {
  CONTACT_FIELDS,
  CONTACT_LIMITS,
  type ContactErrorCode,
  type ContactField,
  type ContactFieldErrors,
} from "./fields";

// Server side only (Zod stays out of the browser bundle, see ./fields): the
// browser checks fields natively, the server again here.

const ERROR_CODES: ReadonlySet<string> = new Set([
  "required",
  "too_short",
  "too_long",
  "invalid",
]);

// One-line fields refuse every control character (line breaks could forge an
// email header), line separators and bidirectional overrides (which spoof how
// the text reads). The message keeps line breaks and tabs. Postgres refuses NUL.
const SINGLE_LINE = /^[^\p{Cc}\u2028\u2029\u202A-\u202E\u2066-\u2069]*$/u;
const MULTI_LINE = /^[^\p{Cc}\u202A-\u202E\u2066-\u2069]*$/u;
const LINE_BREAKS_AND_TABS = /[\n\t]/g;

function singleLine(max: number) {
  return z
    .string()
    .trim()
    .min(1, "required")
    .max(max, "too_long")
    .regex(SINGLE_LINE, "invalid");
}

const contactInputSchema = z.object({
  name: singleLine(CONTACT_LIMITS.name),
  email: z
    .string()
    .trim()
    .min(1, "required")
    .max(CONTACT_LIMITS.email, "too_long")
    .pipe(z.email("invalid")),
  subject: singleLine(CONTACT_LIMITS.subject),
  message: z
    .string()
    // Forms send line breaks as CRLF, which the browser's maxLength counts once.
    .overwrite((text) => text.replace(/\r\n?/g, "\n"))
    .trim()
    .min(1, "required")
    .min(CONTACT_LIMITS.messageMin, "too_short")
    .max(CONTACT_LIMITS.message, "too_long")
    .refine(
      (text) => MULTI_LINE.test(text.replace(LINE_BREAKS_AND_TABS, "")),
      "invalid",
    ),
});

export type ContactInput = z.output<typeof contactInputSchema>;

function codeOf(issue: z.core.$ZodIssue): ContactErrorCode {
  if (issue.code === "invalid_type") {
    return "required";
  }
  return ERROR_CODES.has(issue.message)
    ? (issue.message as ContactErrorCode)
    : "invalid";
}

/** The form's values, or the first error code of each invalid field. */
export function parseContactInput(
  raw: Readonly<Record<string, unknown>>,
): Result<ContactInput, ContactFieldErrors> {
  const parsed = contactInputSchema.safeParse(raw);
  if (parsed.success) {
    return ok(parsed.data);
  }
  const errors: Partial<Record<ContactField, ContactErrorCode>> = {};
  for (const issue of parsed.error.issues) {
    const [field] = issue.path;
    if (
      typeof field === "string" &&
      CONTACT_FIELDS.some((known) => known === field) &&
      errors[field as ContactField] === undefined
    ) {
      errors[field as ContactField] = codeOf(issue);
    }
  }
  return err(errors);
}
