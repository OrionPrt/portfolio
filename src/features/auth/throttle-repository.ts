import { and, eq, gt, inArray, max, sql } from "drizzle-orm";

import { runQuery } from "@/db/query";
import { loginThrottles } from "@/db/schema";
import type { Database } from "@/db/types";
import type { Result } from "@/lib/result";

import type { ThrottlePolicy } from "./throttle-policy";
import type { ThrottleScope } from "./vocabulary";

interface ReserveInput {
  readonly key: string;
  readonly scope: ThrottleScope;
  readonly policy: ThrottlePolicy;
  readonly now: Date;
}

export interface Reservation {
  /** Attempts counted in the current window, this one included. */
  readonly failures: number;
  /** False when a lock was running as this attempt arrived: it must not be checked. */
  readonly allowed: boolean;
  /** The lock now in place, if any (this attempt may have started it). */
  readonly lockedUntil: Date | undefined;
}

/**
 * Doublings past this many are capped anyway: the exponent stops here, or
 * power() overflows once a burst pushes a count past a thousand.
 */
const MAX_DOUBLINGS = 30;

/** The lock an attempt count earns, in SQL: the first lock, doubling to the policy's cap. */
function lockFor(
  failures: ReturnType<typeof sql>,
  policy: ThrottlePolicy,
  at: string,
) {
  return sql`${at}::timestamptz + least(${policy.firstLockMs} * power(2, least(${failures} - ${policy.lockAfter}, ${MAX_DOUBLINGS})), ${policy.maxLockMs}) * interval '1 millisecond'`;
}

export function createThrottleRepository(db: Database) {
  return {
    /** The latest lock still running among these keys, if any. */
    lockedUntil: (
      keys: readonly string[],
      now: Date,
    ): Promise<Result<Date | undefined>> =>
      runQuery("auth.throttle_read_failed", async () => {
        const [row] = await db
          .select({ until: max(loginThrottles.lockedUntil) })
          .from(loginThrottles)
          .where(
            and(
              inArray(loginThrottles.key, [...keys]),
              gt(loginThrottles.lockedUntil, now),
            ),
          );
        return row?.until ?? undefined;
      }),

    /**
     * Counts an attempt before its password or code is checked, in one
     * statement. Whether a lock was running is read from the row as this very
     * update finds it (after any concurrent one): a burst of parallel attempts
     * gets no more checks than the policy allows. The count that reaches the
     * threshold sets the lock, which never shrinks (GREATEST).
     */
    reserve: ({
      key,
      scope,
      policy,
      now,
    }: ReserveInput): Promise<Result<Reservation>> =>
      runQuery("auth.throttle_write_failed", async () => {
        const at = now.toISOString();
        const windowStart = new Date(
          now.getTime() - policy.windowMs,
        ).toISOString();
        const t = loginThrottles;
        const expired = sql`${t.windowStartedAt} <= ${windowStart}::timestamptz`;
        const next = sql`case when ${expired} then 1 else ${t.failures} + 1 end`;
        const [row] = await db
          .insert(t)
          .values({
            key,
            scope,
            failures: 1,
            windowStartedAt: now,
            lockedUntil:
              policy.lockAfter <= 1
                ? new Date(now.getTime() + policy.firstLockMs)
                : null,
            attemptAllowed: true,
          })
          .onConflictDoUpdate({
            target: t.key,
            set: {
              failures: next,
              windowStartedAt: sql`case when ${expired} then ${at}::timestamptz else ${t.windowStartedAt} end`,
              attemptAllowed: sql`${expired} or ${t.lockedUntil} is null or ${t.lockedUntil} <= ${at}::timestamptz`,
              lockedUntil: sql`case
                when ${next} >= ${policy.lockAfter}
                  then greatest(case when ${expired} then null else ${t.lockedUntil} end, ${lockFor(next, policy, at)})
                when ${expired} then null
                else ${t.lockedUntil} end`,
            },
          })
          .returning({
            failures: t.failures,
            allowed: t.attemptAllowed,
            lockedUntil: t.lockedUntil,
          });
        if (row === undefined) {
          throw new Error("No throttle row returned");
        }
        return {
          failures: row.failures,
          allowed: row.allowed,
          lockedUntil: row.lockedUntil ?? undefined,
        };
      }),

    /**
     * Gives back a reservation whose attempt succeeded (a network's count is
     * kept for failures only). The attempt was allowed, so no lock ran as it
     * arrived: a lock still equal to the one its own count set (`reservedLock`)
     * goes with it, even above the threshold; a later one, set by a concurrent
     * failure, stays.
     */
    refund: (
      key: string,
      policy: ThrottlePolicy,
      reservedLock: Date | undefined,
    ): Promise<Result<void>> =>
      runQuery("auth.throttle_write_failed", async () => {
        const t = loginThrottles;
        const isBelowThreshold = sql`${t.failures} - 1 < ${policy.lockAfter}`;
        const isOwnLock =
          reservedLock === undefined
            ? sql`false`
            : sql`${t.lockedUntil} = ${reservedLock.toISOString()}::timestamptz`;
        await db
          .update(t)
          .set({
            failures: sql`greatest(${t.failures} - 1, 0)`,
            lockedUntil: sql`case when ${isBelowThreshold} or ${isOwnLock} then null else ${t.lockedUntil} end`,
          })
          .where(eq(t.key, key));
      }),

    clear: (keys: readonly string[]): Promise<Result<void>> =>
      runQuery("auth.throttle_write_failed", async () => {
        await db
          .delete(loginThrottles)
          .where(inArray(loginThrottles.key, [...keys]));
      }),

    /** Every lock and count, of every network and account: the CLI's unlock. */
    clearAll: (): Promise<Result<number>> =>
      runQuery("auth.throttle_write_failed", async () => {
        const rows = await db
          .delete(loginThrottles)
          .returning({ key: loginThrottles.key });
        return rows.length;
      }),
  };
}

export type ThrottleRepository = ReturnType<typeof createThrottleRepository>;
