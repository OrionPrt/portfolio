import { and, asc, eq, sql } from "drizzle-orm";

import { runQuery } from "@/db/query";
import { socialLinks } from "@/db/schema";
import type { Database } from "@/db/types";
import type { SaveOutcome } from "@/features/admin/save-content";
import type { SocialLinkInput } from "@/features/content/schemas";
import type { Result } from "@/lib/result";

export type SocialLinkForEdit = typeof socialLinks.$inferSelect;

/** The social links as the admin edits them: one per kind, in the site's order. */
export function createSocialLinksAdminRepository(db: Database) {
  const ordered = () =>
    db
      .select()
      .from(socialLinks)
      .orderBy(asc(socialLinks.sortOrder), asc(socialLinks.kind));

  return {
    list: (): Promise<Result<readonly SocialLinkForEdit[]>> =>
      runQuery("links.admin_read_failed", () => ordered()),

    /** Added at the end; a kind already there is a conflict. */
    create: ({
      kind,
      url,
      visible,
    }: SocialLinkInput): Promise<Result<SaveOutcome>> =>
      runQuery("links.admin_save_failed", async () => {
        const [row] = await db
          .insert(socialLinks)
          .values({
            kind,
            url,
            visible,
            sortOrder: sql`(select coalesce(max(${socialLinks.sortOrder}) + 1, 0) from ${socialLinks})`,
          })
          .onConflictDoNothing({ target: socialLinks.kind })
          .returning({ id: socialLinks.id });
        return row === undefined
          ? ({ status: "conflict", field: "kind" } as const)
          : ({ status: "saved", id: row.id, isNew: true } as const);
      }),

    /** The kind stays: it must match the row, as the link's scheme depends on it. */
    update: (
      id: string,
      { kind, url, visible }: SocialLinkInput,
    ): Promise<Result<SaveOutcome>> =>
      runQuery("links.admin_save_failed", async () => {
        const rows = await db
          .update(socialLinks)
          .set({ url, visible })
          .where(and(eq(socialLinks.id, id), eq(socialLinks.kind, kind)))
          .returning({ id: socialLinks.id });
        return rows.length === 0
          ? ({ status: "not_found" } as const)
          : ({ status: "saved", id, isNew: false } as const);
      }),

    ids: (): Promise<Result<readonly string[]>> =>
      runQuery("links.admin_read_failed", async () =>
        (await ordered()).map((link) => link.id),
      ),

    reorder: (ids: readonly string[]): Promise<Result<void>> =>
      runQuery("links.admin_save_failed", async () => {
        for (const [sortOrder, id] of ids.entries()) {
          await db
            .update(socialLinks)
            .set({ sortOrder })
            .where(eq(socialLinks.id, id));
        }
      }),
  };
}
