import { MAX_USER_AGENT_LENGTH } from "@/db/schema";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locales";
import { senderNetwork } from "@/lib/client-ip";
import { hashIp } from "@/lib/ip-hash";
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";

import type { ContactConfig } from "./config";
import {
  contactValuesOf,
  HONEYPOT_FIELD,
  TURNSTILE_FIELD,
  type ContactErrorReason,
  type ContactFormState,
} from "./form-state";
import type { NewContactMessage } from "./repository";
import { parseContactInput } from "./schema";

export interface ContactDependencies {
  readonly config: ContactConfig;
  readonly verifyToken: (token: string) => Promise<boolean>;
  /** Counts one message for the hashed sender; false when over the limit. */
  readonly allow: (ipHash: string) => Promise<boolean>;
  readonly store: (message: NewContactMessage) => Promise<Result<void>>;
  readonly notify: (message: NewContactMessage) => Promise<Result<void>>;
  /** Runs a task after the response is sent (Next.js `after`). */
  readonly schedule: (task: () => Promise<unknown>) => void;
}

export interface ContactSubmission {
  readonly fields: Readonly<Record<string, unknown>>;
  readonly ip: string;
  readonly userAgent: string | null;
  readonly locale: string;
}

function localeOf(value: string): Locale {
  return LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE;
}

function textField(fields: ContactSubmission["fields"], name: string): string {
  const value = fields[name];
  return typeof value === "string" ? value : "";
}

/**
 * The contact form's server side, from the cheapest check to the costliest:
 * honeypot, then fields, then Turnstile, then the rate limit (so only
 * submissions that passed Turnstile count), then storage. The owner is
 * notified after the response, and a failed notification loses nothing: the
 * message is already stored.
 */
export async function handleContactSubmission(
  { fields, ip, userAgent, locale }: ContactSubmission,
  deps: ContactDependencies,
): Promise<ContactFormState> {
  const { config } = deps;
  const failed = (reason: ContactErrorReason): ContactFormState => ({
    status: "failed",
    reason,
    values: contactValuesOf(fields),
  });
  if (!config.enabled) {
    logger.error("contact.not_configured", { missing: config.missing });
    return failed("unavailable");
  }
  // A field people never see: whoever fills it is a bot, and is told it worked.
  if (textField(fields, HONEYPOT_FIELD) !== "") {
    logger.info("contact.honeypot");
    return { status: "sent" };
  }
  const input = parseContactInput(fields);
  if (!input.ok) {
    return {
      status: "invalid",
      errors: input.error,
      values: contactValuesOf(fields),
    };
  }
  if (!(await deps.verifyToken(textField(fields, TURNSTILE_FIELD)))) {
    return failed("captcha");
  }
  const ipHash = hashIp(senderNetwork(ip), config.ipHashSalt);
  if (!(await deps.allow(ipHash))) {
    logger.info("contact.rate_limited");
    return failed("rate_limited");
  }
  const message: NewContactMessage = {
    ...input.data,
    locale: localeOf(locale),
    ipHash,
    userAgent: userAgent?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
  };
  if (!(await deps.store(message)).ok) {
    return failed("unavailable");
  }
  if (config.mail !== undefined) {
    deps.schedule(() => deps.notify(message));
  }
  return { status: "sent" };
}
