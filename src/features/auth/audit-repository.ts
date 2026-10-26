import { and, count, desc, eq, gt } from "drizzle-orm";

import { runQuery } from "@/db/query";
import { auditLogs } from "@/db/schema";
import type { Database } from "@/db/types";
import { redact } from "@/lib/redact";
import type { Result } from "@/lib/result";

import type { AuditAction } from "./vocabulary";

export interface AuditEvent {
  readonly actorId?: string | null;
  readonly action: AuditAction;
  readonly entity?: string;
  readonly entityId?: string;
  /** What changed; secrets are masked before storage, whatever the caller passes. */
  readonly diff?: Readonly<Record<string, unknown>>;
  readonly ipHash?: string | null;
  readonly userAgent?: string | null;
}

/** Who acts, as the audit log records it: the account, its network's keyed hash, its browser. */
export interface AuditActor {
  readonly actorId: string;
  readonly ipHash: string | null;
  readonly userAgent: string | null;
}

export type AuditEntry = typeof auditLogs.$inferSelect;

export function createAuditRepository(db: Database) {
  return {
    record: (event: AuditEvent): Promise<Result<void>> =>
      runQuery(
        "auth.audit_write_failed",
        async () => {
          await db.insert(auditLogs).values({
            actorId: event.actorId ?? null,
            action: event.action,
            entity: event.entity ?? null,
            entityId: event.entityId ?? null,
            diff: event.diff === undefined ? null : redact(event.diff),
            ipHash: event.ipHash ?? null,
            userAgent: event.userAgent ?? null,
          });
        },
        { hasPersonalData: true },
      ),

    /** How many events of one kind since a time: lockout alerts are sent once an hour. */
    countSince: (action: AuditAction, since: Date): Promise<Result<number>> =>
      runQuery("auth.audit_read_failed", async () => {
        const [row] = await db
          .select({ total: count() })
          .from(auditLogs)
          .where(
            and(eq(auditLogs.action, action), gt(auditLogs.createdAt, since)),
          );
        return row?.total ?? 0;
      }),

    /** Newest first, one page at a time. */
    list: ({
      limit,
      offset,
    }: {
      readonly limit: number;
      readonly offset: number;
    }): Promise<Result<AuditEntry[]>> =>
      runQuery("auth.audit_read_failed", () =>
        db
          .select()
          .from(auditLogs)
          .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
          .limit(limit)
          .offset(offset),
      ),
  };
}

export type AuditRepository = ReturnType<typeof createAuditRepository>;
