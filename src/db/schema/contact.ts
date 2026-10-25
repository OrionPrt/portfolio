import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { CONTACT_LIMITS } from "@/features/contact/fields";

import { localeEnum, messageStatusEnum } from "./enums";

/** Bounded so a long header cannot bloat a row; the value is informative only. */
export const MAX_USER_AGENT_LENGTH = 512;

// CHECK constraints are DDL: the constant limits below are inlined, never input.
function maxLength(column: string, max: number) {
  return sql.raw(`char_length("${column}") <= ${String(max)}`);
}

/**
 * Messages from the contact form. The sender's IP is never stored: only a keyed
 * hash (HMAC-SHA-256), enough to spot abuse. Kept 12 months (purged by the
 * daily cron, P8).
 */
export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    locale: localeEnum("locale").notNull(),
    status: messageStatusEnum("status").notNull().default("unread"),
    ipHash: text("ip_hash").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "contact_messages_name_length",
      maxLength("name", CONTACT_LIMITS.name),
    ),
    check(
      "contact_messages_email_length",
      maxLength("email", CONTACT_LIMITS.email),
    ),
    check(
      "contact_messages_subject_length",
      maxLength("subject", CONTACT_LIMITS.subject),
    ),
    check(
      "contact_messages_body_length",
      maxLength("body", CONTACT_LIMITS.message),
    ),
    check(
      "contact_messages_user_agent_length",
      sql`${t.userAgent} is null or ${maxLength("user_agent", MAX_USER_AGENT_LENGTH)}`,
    ),
    check(
      "contact_messages_ip_hash_format",
      sql`${t.ipHash} ~ '^[0-9a-f]{64}$'`,
    ),
    // The inbox (P6): newest first, by status.
    index("contact_messages_status_created_idx").on(
      t.status,
      t.createdAt.desc(),
    ),
  ],
);
