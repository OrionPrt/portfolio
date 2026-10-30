import { and, isNull, lt, lte, or, sql } from "drizzle-orm";

import { runQuery } from "@/db/query";
import { rowsOf } from "@/db/rows";
import { adminSessions, contactMessages, loginThrottles } from "@/db/schema";
import type { Database } from "@/db/types";
import { createAuditRepository } from "@/features/auth/audit-repository";
import { THROTTLE_POLICY } from "@/features/auth/throttle-policy";

/** What the daily purge removes (ADR-0009). */
export const RETENTION_TARGETS = [
  "messages",
  "sessions",
  "throttles",
  "auditLogs",
] as const;

export type RetentionTarget = (typeof RETENTION_TARGETS)[number];

/** The rows each purge removed; undefined where it failed (logged as it did). */
export type PurgeReport = Readonly<Record<RetentionTarget, number | undefined>>;

/**
 * The longest window a sign-in count lives in: past it, and with no lock
 * running, a count starts over anyway (throttle-repository.ts).
 */
const LONGEST_THROTTLE_WINDOW_MS = Math.max(
  ...Object.values(THROTTLE_POLICY).map((policy) => policy.windowMs),
);

function purges(db: Database, now: Date) {
  return {
    // Kept 12 months, as the contact form says.
    messages: () =>
      runQuery(
        "retention.messages_failed",
        async () =>
          (
            await db
              .delete(contactMessages)
              .where(
                lt(
                  contactMessages.createdAt,
                  sql`${now.toISOString()}::timestamptz - interval '12 months'`,
                ),
              )
              .returning({ id: contactMessages.id })
          ).length,
        { hasPersonalData: true },
      ),
    sessions: () =>
      runQuery(
        "retention.sessions_failed",
        async () =>
          (
            await db
              .delete(adminSessions)
              .where(lte(adminSessions.expiresAt, now))
              .returning({ id: adminSessions.id })
          ).length,
      ),
    throttles: () =>
      runQuery(
        "retention.throttles_failed",
        async () =>
          (
            await db
              .delete(loginThrottles)
              .where(
                and(
                  lte(
                    loginThrottles.windowStartedAt,
                    new Date(now.getTime() - LONGEST_THROTTLE_WINDOW_MS),
                  ),
                  or(
                    isNull(loginThrottles.lockedUntil),
                    lte(loginThrottles.lockedUntil, now),
                  ),
                ),
              )
              .returning({ key: loginThrottles.key })
          ).length,
      ),
    // The site may not delete from the log: the owner's function does, for
    // entries over 12 months old only (migration 0007).
    auditLogs: () =>
      runQuery("retention.audit_failed", async () => {
        const [row] = rowsOf(
          await db.execute(sql`select public.purge_audit_logs() as purged`),
        ) as readonly { readonly purged: number }[];
        return row?.purged ?? 0;
      }),
  } satisfies Record<RetentionTarget, unknown>;
}

/**
 * "messages=2 sessions=0 throttles=1 auditLogs=0": one value, as logs and the
 * audit log keep it (their redaction masks any key named like "sessions").
 */
export function summaryOf(report: PurgeReport): string {
  return RETENTION_TARGETS.map(
    (target) => `${target}=${String(report[target] ?? "failed")}`,
  ).join(" ");
}

/**
 * Deletes what the site no longer keeps, each kind on its own: one failing
 * leaves the others done. A purge that removed anything is audited, so even
 * the audit log's own deletions leave a trace.
 */
export async function purgeExpired(
  db: Database,
  now: Date,
): Promise<PurgeReport> {
  const run = purges(db, now);
  const outcomes = await Promise.all(
    RETENTION_TARGETS.map(async (target) => {
      const outcome = await run[target]();
      return [target, outcome.ok ? outcome.data : undefined] as const;
    }),
  );
  const report = Object.fromEntries(outcomes) as PurgeReport;
  if (outcomes.some(([, count]) => count !== undefined && count > 0)) {
    // A failure is logged by the repository; the purge itself stands.
    await createAuditRepository(db).record({
      action: "retention.purged",
      diff: { purged: summaryOf(report) },
    });
  }
  return report;
}
