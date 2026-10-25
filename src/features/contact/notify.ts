import type { Locale } from "@/i18n/locales";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { logger } from "@/lib/logger";
import { err, ok, type Result } from "@/lib/result";

import type { MailConfig } from "./config";
import type { ContactInput } from "./schema";

const RESEND_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 8000;

interface NotifyInput {
  readonly message: ContactInput & { readonly locale: Locale };
  readonly mail: MailConfig;
  readonly fetchImpl?: typeof fetch;
}

function textOf({ message }: Pick<NotifyInput, "message">): string {
  return [
    `De : ${message.name} <${message.email}>`,
    `Langue : ${message.locale}`,
    `Objet : ${message.subject}`,
    "",
    message.message,
  ].join("\n");
}

/**
 * Tells the owner a message arrived: plain text, to their address only, with
 * Reply-To set to the sender. No acknowledgement goes to the sender, so the
 * form cannot be used to send mail to a third party. Logs carry the status,
 * never the message.
 */
export async function sendContactNotification({
  message,
  mail,
  fetchImpl = fetchWithTimeout(fetch, SEND_TIMEOUT_MS),
}: NotifyInput): Promise<Result<void>> {
  const failure = err({
    code: "MAIL_FAILED",
    message: "The notification could not be sent.",
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
        reply_to: message.email,
        subject: `[Portfolio] ${message.subject}`,
        text: textOf({ message }),
      }),
    });
    if (!response.ok) {
      logger.error("contact.mail_refused", { status: response.status });
      return failure;
    }
    return ok(undefined);
  } catch (error) {
    logger.error("contact.mail_unavailable", { error });
    return failure;
  }
}
