import { and, asc, count, eq, ne, sql } from "drizzle-orm";

import { MAX_PLATFORMS } from "@/db/limits";
import { runQuery } from "@/db/query";
import { platforms } from "@/db/schema";
import type { Database } from "@/db/types";
import { reorderRows } from "@/features/admin/reorder";
import type { SaveOutcome } from "@/features/admin/save-content";
import type { PlatformInput } from "@/features/content/schemas";
import type { Result } from "@/lib/result";

export type PlatformForEdit = typeof platforms.$inferSelect;

const CONFLICT = { status: "conflict", field: "name" } as const;
const NOT_FOUND = { status: "not_found" } as const;

/** The platforms as the admin edits them, in the site's order (ADR-0009). */
export function createPlatformsAdminRepository(db: Database) {
  const ordered = () =>
    db
      .select()
      .from(platforms)
      .orderBy(asc(platforms.sortOrder), asc(platforms.name))
      .limit(MAX_PLATFORMS);

  const isNameTaken = async (name: string, exceptId: string) => {
    const [taken] = await db
      .select({ id: platforms.id })
      .from(platforms)
      .where(and(eq(platforms.name, name), ne(platforms.id, exceptId)));
    return taken !== undefined;
  };

  return {
    list: (): Promise<Result<readonly PlatformForEdit[]>> =>
      runQuery("platforms.admin_read_failed", () => ordered()),

    /** Added at the end; a name already there is a conflict. */
    create: (input: PlatformInput): Promise<Result<SaveOutcome>> =>
      runQuery("platforms.admin_save_failed", async () => {
        const [counted] = await db.select({ total: count() }).from(platforms);
        // The lists stop there: one more would never show.
        if ((counted?.total ?? 0) >= MAX_PLATFORMS) {
          return { status: "full" } as const;
        }
        const [row] = await db
          .insert(platforms)
          .values({
            ...input,
            sortOrder: sql`(select coalesce(max(${platforms.sortOrder}) + 1, 0) from ${platforms})`,
          })
          .onConflictDoNothing({ target: platforms.name })
          .returning({ id: platforms.id });
        return row === undefined
          ? CONFLICT
          : ({ status: "saved", id: row.id, isNew: true } as const);
      }),

    update: (id: string, input: PlatformInput): Promise<Result<SaveOutcome>> =>
      runQuery("platforms.admin_save_failed", async () => {
        if (await isNameTaken(input.name, id)) {
          return CONFLICT;
        }
        const rows = await db
          .update(platforms)
          .set(input)
          .where(eq(platforms.id, id))
          .returning({ id: platforms.id });
        return rows.length === 0
          ? NOT_FOUND
          : ({ status: "saved", id, isNew: false } as const);
      }),

    ids: (): Promise<Result<readonly string[]>> =>
      runQuery("platforms.admin_read_failed", async () =>
        (await ordered()).map((platform) => platform.id),
      ),

    reorder: (ids: readonly string[]): Promise<Result<void>> =>
      runQuery("platforms.admin_save_failed", () =>
        reorderRows(
          db,
          {
            table: platforms,
            idColumn: platforms.id,
            placeColumn: platforms.sortOrder,
          },
          ids,
        ),
      ),
  };
}
