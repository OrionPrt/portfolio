import type { Locale } from "@/i18n/locales";
import { sendMail, type MailConfig } from "@/lib/mail";
import type { Result } from "@/lib/result";

import type { ContactInput } from "./schema";

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
export function sendContactNotification({
  message,
  mail,
  fetchImpl,
}: NotifyInput): Promise<Result<void>> {
  return sendMail({
    mail,
    message: {
      subject: `[Portfolio] ${message.subject}`,
      text: textOf({ message }),
      replyTo: message.email,
    },
    event: "contact",
    ...(fetchImpl === undefined ? {} : { fetchImpl }),
  });
}
