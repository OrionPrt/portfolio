import { fetchWithTimeout } from "./fetch-timeout";
import { logger } from "./logger";
import { err, ok, type Result } from "./result";

const RESEND_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 8000;

/** Without a verified domain, Resend only sends from this address (P12 adds one). */
const DEFAULT_FROM = "Portfolio <onboarding@resend.dev>";

export interface MailConfig {
  readonly apiKey: string;
  readonly to: string;
  readonly from: string;
}

export interface OutgoingMail {
  readonly subject: string;
  readonly text: string;
  readonly replyTo?: string;
}

interface SendMailInput {
  readonly mail: MailConfig;
  readonly message: OutgoingMail;
  /** Prefix of the log events, e.g. "contact" gives "contact.mail_refused". */
  readonly event: string;
  readonly fetchImpl?: typeof fetch;
}

/**
 * Sends a plain-text email to the owner (only ever to `mail.to`) through
 * Resend's REST API. Failures log the HTTP status, never the content.
 */
export async function sendMail({
  mail,
  message,
  event,
  fetchImpl = fetchWithTimeout(fetch, SEND_TIMEOUT_MS),
}: SendMailInput): Promise<Result<void>> {
  const failure = err({
    code: "MAIL_FAILED",
    message: "The email could not be sent.",
  });
  try {
    const response = await fetchImpl(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mail.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mail.from,
        to: [mail.to],
        ...(message.replyTo === undefined ? {} : { reply_to: message.replyTo }),
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!response.ok) {
      logger.error(`${event}.mail_refused`, { status: response.status });
      return failure;
    }
    return ok(undefined);
  } catch (error) {
    logger.error(`${event}.mail_unavailable`, { error });
    return failure;
  }
}

interface MailEnv {
  readonly RESEND_API_KEY?: string | undefined;
  readonly CONTACT_TO_EMAIL?: string | undefined;
  readonly CONTACT_FROM_EMAIL?: string | undefined;
}

/** The owner's mailbox, when Resend is configured; else nobody is emailed. */
export function mailConfigOf(env: MailEnv): MailConfig | undefined {
  return env.RESEND_API_KEY !== undefined && env.CONTACT_TO_EMAIL !== undefined
    ? {
        apiKey: env.RESEND_API_KEY,
        to: env.CONTACT_TO_EMAIL,
        from: env.CONTACT_FROM_EMAIL ?? DEFAULT_FROM,
      }
    : undefined;
}
