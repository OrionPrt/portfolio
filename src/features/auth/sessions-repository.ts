import { and, desc, eq, gt, inArray, lte, ne } from "drizzle-orm";

import { runQuery } from "@/db/query";
import { adminSessions, adminUsers } from "@/db/schema";
import type { Database } from "@/db/types";
import type { Result } from "@/lib/result";

import type { AdminUserRecord } from "./users-repository";
import type { SessionStage } from "./vocabulary";

/** Sessions shown or revoked at once: one admin never has more. */
const MAX_LISTED = 50;

export type AdminSessionRecord = typeof adminSessions.$inferSelect;

/** createdAt is the app's clock, like every time the policy compares. */
export type NewSession = Pick<
  AdminSessionRecord,
  "id" | "userId" | "stage" | "createdAt" | "expiresAt" | "ipHash" | "userAgent"
>;

export interface SessionWithUser {
  readonly session: AdminSessionRecord;
  readonly user: AdminUserRecord;
}

export function createSessionsRepository(db: Database) {
  return {
    create: (session: NewSession): Promise<Result<void>> =>
      runQuery(
        "auth.session_create_failed",
        async () => {
          await db
            .insert(adminSessions)
            .values({ ...session, lastSeenAt: session.createdAt });
        },
        { hasPersonalData: true },
      ),

    findWithUser: (id: string): Promise<Result<SessionWithUser | undefined>> =>
      runQuery("auth.session_read_failed", async () => {
        const [row] = await db
          .select({ session: adminSessions, user: adminUsers })
          .from(adminSessions)
          .innerJoin(adminUsers, eq(adminSessions.userId, adminUsers.id))
          .where(eq(adminSessions.id, id))
          .limit(1);
        return row;
      }),

    touch: (id: string, at: Date): Promise<Result<void>> =>
      runQuery("auth.session_touch_failed", async () => {
        await db
          .update(adminSessions)
          .set({ lastSeenAt: at })
          .where(eq(adminSessions.id, id));
      }),

    delete: (id: string): Promise<Result<void>> =>
      runQuery("auth.session_delete_failed", async () => {
        await db.delete(adminSessions).where(eq(adminSessions.id, id));
      }),

    /**
     * Uses up a login step's session: deleted only if it belongs to the
     * account, is at that stage and still live. True once: two requests
     * racing with one partial session cannot both complete it.
     */
    consumeAtStage: (
      id: string,
      userId: string,
      stage: SessionStage,
      now: Date,
    ): Promise<Result<boolean>> =>
      runQuery("auth.session_delete_failed", async () => {
        const rows = await db
          .delete(adminSessions)
          .where(
            and(
              eq(adminSessions.id, id),
              eq(adminSessions.userId, userId),
              eq(adminSessions.stage, stage),
              gt(adminSessions.expiresAt, now),
            ),
          )
          .returning({ id: adminSessions.id });
        return rows.length === 1;
      }),

    /** The account's sessions among these ids, in one statement: the number deleted. */
    deleteOwned: (
      ids: readonly string[],
      userId: string,
    ): Promise<Result<number>> =>
      runQuery("auth.session_delete_failed", async () => {
        if (ids.length === 0) {
          return 0;
        }
        const rows = await db
          .delete(adminSessions)
          .where(
            and(
              inArray(adminSessions.id, ids.slice(0, MAX_LISTED)),
              eq(adminSessions.userId, userId),
            ),
          )
          .returning({ id: adminSessions.id });
        return rows.length;
      }),

    /** Every session of the account but one (or all): the number deleted. */
    deleteForUser: (
      userId: string,
      exceptId?: string,
    ): Promise<Result<number>> =>
      runQuery("auth.session_delete_failed", async () => {
        const rows = await db
          .delete(adminSessions)
          .where(
            exceptId === undefined
              ? eq(adminSessions.userId, userId)
              : and(
                  eq(adminSessions.userId, userId),
                  ne(adminSessions.id, exceptId),
                ),
          )
          .returning({ id: adminSessions.id });
        return rows.length;
      }),

    deleteExpired: (now: Date): Promise<Result<number>> =>
      runQuery("auth.session_purge_failed", async () => {
        const rows = await db
          .delete(adminSessions)
          .where(lte(adminSessions.expiresAt, now))
          .returning({ id: adminSessions.id });
        return rows.length;
      }),

    /** The account's live, signed-in sessions, latest activity first. */
    listForUser: (
      userId: string,
      now: Date,
    ): Promise<Result<AdminSessionRecord[]>> =>
      runQuery("auth.session_list_failed", () =>
        db
          .select()
          .from(adminSessions)
          .where(
            and(
              eq(adminSessions.userId, userId),
              eq(adminSessions.stage, "signed_in"),
              gt(adminSessions.expiresAt, now),
            ),
          )
          .orderBy(desc(adminSessions.lastSeenAt))
          .limit(MAX_LISTED),
      ),
  };
}

export type SessionsRepository = ReturnType<typeof createSessionsRepository>;
