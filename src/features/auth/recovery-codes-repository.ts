import { and, count, eq, isNull, sql } from "drizzle-orm";

import { runQuery } from "@/db/query";
import { recoveryCodes } from "@/db/schema";
import type { Database } from "@/db/types";
import type { Result } from "@/lib/result";

export function createRecoveryCodesRepository(db: Database) {
  return {
    /**
     * Replaces every code of the account in one statement (a data-modifying
     * CTE): the old codes stop working exactly when the new ones start, and
     * the app's HTTP driver has no transactions.
     */
    replace: (
      userId: string,
      hashes: readonly string[],
    ): Promise<Result<void>> =>
      runQuery("auth.recovery_codes_replace_failed", async () => {
        const rows = sql.join(
          hashes.map((hash) => sql`(${userId}::uuid, ${hash})`),
          sql`, `,
        );
        await db.execute(sql`
          with removed as (
            delete from ${recoveryCodes} where ${recoveryCodes.userId} = ${userId}::uuid
          )
          insert into ${recoveryCodes} (user_id, code_hash) values ${rows}
        `);
      }),

    /** Every code of the account, used or not (second factor reset). */
    deleteAll: (userId: string): Promise<Result<void>> =>
      runQuery("auth.recovery_codes_delete_failed", async () => {
        await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
      }),

    /** Uses a code: true once, false for an unknown or used code. */
    consume: (userId: string, hash: string): Promise<Result<boolean>> =>
      runQuery("auth.recovery_code_use_failed", async () => {
        const rows = await db
          .update(recoveryCodes)
          .set({ usedAt: new Date() })
          .where(
            and(
              eq(recoveryCodes.userId, userId),
              eq(recoveryCodes.codeHash, hash),
              isNull(recoveryCodes.usedAt),
            ),
          )
          .returning({ id: recoveryCodes.id });
        return rows.length === 1;
      }),

    countUnused: (userId: string): Promise<Result<number>> =>
      runQuery("auth.recovery_codes_count_failed", async () => {
        const [row] = await db
          .select({ total: count() })
          .from(recoveryCodes)
          .where(
            and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)),
          );
        return row?.total ?? 0;
      }),
  };
}

export type RecoveryCodesRepository = ReturnType<
  typeof createRecoveryCodesRepository
>;
