import { runQuery } from "@/db/query";
import { contactMessages } from "@/db/schema";
import type { Database } from "@/db/types";
import type { Locale } from "@/i18n/locales";
import type { Result } from "@/lib/result";

import type { ContactInput } from "./schema";

export interface NewContactMessage extends ContactInput {
  readonly locale: Locale;
  /** HMAC of the sender's address: the address itself is never stored. */
  readonly ipHash: string;
  readonly userAgent: string | null;
}

export interface ContactRepository {
  readonly create: (message: NewContactMessage) => Promise<Result<void>>;
}

export function createContactRepository(db: Database): ContactRepository {
  return {
    create: (message) =>
      runQuery(
        "contact.create_failed",
        async () => {
          await db.insert(contactMessages).values({
            name: message.name,
            email: message.email,
            subject: message.subject,
            body: message.message,
            locale: message.locale,
            ipHash: message.ipHash,
            userAgent: message.userAgent,
          });
        },
        { hasPersonalData: true },
      ),
  };
}
