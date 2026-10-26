import { and, count, eq, isNull, lt, or } from "drizzle-orm";

import { runQuery } from "@/db/query";
import { adminUsers } from "@/db/schema";
import type { Database } from "@/db/types";
import type { Result } from "@/lib/result";

export type AdminUserRecord = typeof adminUsers.$inferSelect;

interface EnrolledAdmin {
  /** Chosen before insertion: the sealed secret is bound to it. */
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly totpSecret: string;
  readonly totpLastStep: number;
}

/** Every write here holds a credential: errors are logged without values. */
const PERSONAL = { hasPersonalData: true } as const;

export function createUsersRepository(db: Database) {
  // The email typed (or a password typed in its place) is a value of the query.
  const findOne = (event: string, where: ReturnType<typeof eq>) =>
    runQuery(
      event,
      async () => {
        const [user] = await db.select().from(adminUsers).where(where).limit(1);
        return user;
      },
      PERSONAL,
    );

  return {
    findByEmail: (
      email: string,
    ): Promise<Result<AdminUserRecord | undefined>> =>
      findOne(
        "auth.user_read_failed",
        eq(adminUsers.email, email.trim().toLowerCase()),
      ),

    findById: (id: string): Promise<Result<AdminUserRecord | undefined>> =>
      findOne("auth.user_read_failed", eq(adminUsers.id, id)),

    count: (): Promise<Result<number>> =>
      runQuery("auth.user_count_failed", async () => {
        const [row] = await db.select({ total: count() }).from(adminUsers);
        return row?.total ?? 0;
      }),

    /**
     * The admin account, created with its second factor already set up (the
     * CLI checked a first code): the web never sees an account without it.
     */
    createEnrolled: (admin: EnrolledAdmin): Promise<Result<AdminUserRecord>> =>
      runQuery(
        "auth.user_create_failed",
        async () => {
          const [user] = await db
            .insert(adminUsers)
            .values({
              ...admin,
              email: admin.email.trim().toLowerCase(),
              totpEnabledAt: new Date(),
            })
            .returning();
          if (user === undefined) {
            throw new Error("No row returned");
          }
          return user;
        },
        PERSONAL,
      ),

    /** A new second factor (CLI reset), with the step of its first code. */
    replaceTotp: (
      id: string,
      sealed: string,
      step: number,
    ): Promise<Result<void>> =>
      runQuery(
        "auth.totp_replace_failed",
        async () => {
          await db
            .update(adminUsers)
            .set({
              totpSecret: sealed,
              totpEnabledAt: new Date(),
              totpLastStep: step,
            })
            .where(eq(adminUsers.id, id));
        },
        PERSONAL,
      ),

    /**
     * Records a step as used, in one statement: false when it, or a later
     * one, was already accepted. Two requests racing with one code cannot
     * both succeed.
     */
    acceptTotpStep: (id: string, step: number): Promise<Result<boolean>> =>
      runQuery("auth.totp_step_failed", async () => {
        const rows = await db
          .update(adminUsers)
          .set({ totpLastStep: step })
          .where(
            and(
              eq(adminUsers.id, id),
              or(
                isNull(adminUsers.totpLastStep),
                lt(adminUsers.totpLastStep, step),
              ),
            ),
          )
          .returning({ id: adminUsers.id });
        return rows.length === 1;
      }),

    updatePassword: (id: string, passwordHash: string): Promise<Result<void>> =>
      runQuery(
        "auth.password_update_failed",
        async () => {
          await db
            .update(adminUsers)
            .set({ passwordHash, passwordChangedAt: new Date() })
            .where(eq(adminUsers.id, id));
        },
        PERSONAL,
      ),
  };
}

export type UsersRepository = ReturnType<typeof createUsersRepository>;
