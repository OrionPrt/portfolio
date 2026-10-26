import { and, count, desc, eq, inArray, sql } from "drizzle-orm";

import { runQuery } from "@/db/query";
import { rowsOf } from "@/db/rows";
import { auditLogs, contactMessages } from "@/db/schema";
import type { Database } from "@/db/types";
import type { AuditActor } from "@/features/auth/audit-repository";
import type { MessageStatus } from "@/features/content/vocabulary";
import type { Locale } from "@/i18n/locales";
import type { Result } from "@/lib/result";

/** Received messages (read or not), or the archived ones. */
export type InboxView = "received" | "archived";

const STATUSES_OF: Readonly<Record<InboxView, readonly MessageStatus[]>> = {
  received: ["unread", "read"],
  archived: ["archived"],
};

export interface InboxMessageSummary {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly status: MessageStatus;
  readonly createdAt: Date;
}

export interface InboxMessage extends InboxMessageSummary {
  readonly body: string;
  readonly locale: Locale;
  readonly userAgent: string | null;
}

export interface InboxPage {
  readonly messages: readonly InboxMessageSummary[];
  /** Every message of the view, for the pagination. */
  readonly total: number;
}

interface ListRequest {
  readonly view: InboxView;
  readonly limit: number;
  readonly offset: number;
}

const SUMMARY = {
  id: contactMessages.id,
  name: contactMessages.name,
  email: contactMessages.email,
  subject: contactMessages.subject,
  status: contactMessages.status,
  createdAt: contactMessages.createdAt,
};

/** Every read and write here holds personal data: failures log no values. */
const PERSONAL = { hasPersonalData: true } as const;

/** The admin's inbox. Messages are shown as text only, never as HTML. */
export function createInboxRepository(db: Database) {
  const t = contactMessages;
  return {
    list: ({ view, limit, offset }: ListRequest): Promise<Result<InboxPage>> =>
      runQuery(
        "contact.inbox_failed",
        async () => {
          const inView = inArray(t.status, [...STATUSES_OF[view]]);
          const [messages, [counted]] = await Promise.all([
            db
              .select(SUMMARY)
              .from(t)
              .where(inView)
              .orderBy(desc(t.createdAt), desc(t.id))
              .limit(limit)
              .offset(offset),
            db.select({ total: count() }).from(t).where(inView),
          ]);
          return { messages, total: counted?.total ?? 0 };
        },
        PERSONAL,
      ),

    find: (id: string): Promise<Result<InboxMessage | undefined>> =>
      runQuery(
        "contact.inbox_failed",
        async () => {
          const [message] = await db
            .select({
              ...SUMMARY,
              body: t.body,
              locale: t.locale,
              userAgent: t.userAgent,
            })
            .from(t)
            .where(eq(t.id, id));
          return message;
        },
        PERSONAL,
      ),

    countUnread: (): Promise<Result<number>> =>
      runQuery("contact.inbox_failed", async () => {
        const [counted] = await db
          .select({ total: count() })
          .from(t)
          .where(eq(t.status, "unread"));
        return counted?.total ?? 0;
      }),

    /** True when the message exists. */
    setStatus: (id: string, status: MessageStatus): Promise<Result<boolean>> =>
      runQuery(
        "contact.inbox_failed",
        async () => {
          const rows = await db
            .update(t)
            .set({ status })
            .where(eq(t.id, id))
            .returning({ id: t.id });
          return rows.length > 0;
        },
        PERSONAL,
      ),

    /** Opening a message reads it, unless it was filed: archived stays archived. */
    markRead: (id: string): Promise<Result<void>> =>
      runQuery(
        "contact.inbox_failed",
        async () => {
          await db
            .update(t)
            .set({ status: "read" })
            .where(and(eq(t.id, id), eq(t.status, "unread")));
        },
        PERSONAL,
      ),

    /**
     * Deletes a message and audits it in one statement: a deletion is never
     * left unrecorded. The audit row keeps the id only, no content. True when
     * the message existed.
     */
    deleteAudited: (id: string, actor: AuditActor): Promise<Result<boolean>> =>
      runQuery(
        "contact.inbox_failed",
        async () => {
          const result = await db.execute(sql`
            with deleted as (
              delete from ${t} where ${t.id} = ${id}::uuid returning ${t.id}
            )
            insert into ${auditLogs} (actor_id, action, entity, entity_id, ip_hash, user_agent)
            select ${actor.actorId}::uuid, ${"contact.message_deleted"}, ${"contact_message"}, deleted.id::text, ${actor.ipHash}, ${actor.userAgent}
            from deleted
            returning ${auditLogs.entityId}
          `);
          return rowsOf(result).length > 0;
        },
        PERSONAL,
      ),
  };
}

export type InboxRepository = ReturnType<typeof createInboxRepository>;
