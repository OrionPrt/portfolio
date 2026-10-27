import { and, asc, count, eq, ne, sql } from "drizzle-orm";

import { MAX_SKILLS } from "@/db/limits";
import { runQuery } from "@/db/query";
import { experienceSkills, projectSkills, skills } from "@/db/schema";
import type { Database } from "@/db/types";
import type { SaveOutcome } from "@/features/admin/save-content";
import type { SkillInput } from "@/features/content/schemas";
import type { SkillDomain } from "@/features/content/vocabulary";
import { reorderRows } from "@/features/admin/reorder";
import type { Result } from "@/lib/result";

export type SkillForEdit = typeof skills.$inferSelect;

export interface SkillListEntry extends SkillForEdit {
  /** Entries that link it: deleting the skill removes those links. */
  readonly projectCount: number;
  readonly experienceCount: number;
}

const FIELDS = {
  id: skills.id,
  slug: skills.slug,
  name: skills.name,
  domain: skills.domain,
  featured: skills.featured,
  sortOrder: skills.sortOrder,
};

const WITH_USAGE = {
  ...FIELDS,
  projectCount: sql<number>`(select count(*) from ${projectSkills} where ${projectSkills.skillId} = ${skills.id})::int`,
  experienceCount: sql<number>`(select count(*) from ${experienceSkills} where ${experienceSkills.skillId} = ${skills.id})::int`,
};

/** The next place at the end of a domain. */
function endOf(domain: SkillDomain) {
  return sql<number>`(select coalesce(max(${skills.sortOrder}) + 1, 0) from ${skills} where ${skills.domain} = ${domain})`;
}

/** The skills as the admin edits them; the order is kept per domain. */
export function createSkillsAdminRepository(db: Database) {
  const isSlugTaken = async (slug: string, exceptId?: string) => {
    const [taken] = await db
      .select({ id: skills.id })
      .from(skills)
      .where(
        exceptId === undefined
          ? eq(skills.slug, slug)
          : and(eq(skills.slug, slug), ne(skills.id, exceptId)),
      );
    return taken !== undefined;
  };

  return {
    list: (): Promise<Result<readonly SkillListEntry[]>> =>
      runQuery("skills.admin_read_failed", () =>
        db
          .select(WITH_USAGE)
          .from(skills)
          .orderBy(asc(skills.domain), asc(skills.sortOrder), asc(skills.name)),
      ),

    find: (id: string): Promise<Result<SkillListEntry | undefined>> =>
      runQuery("skills.admin_read_failed", async () => {
        const [skill] = await db
          .select(WITH_USAGE)
          .from(skills)
          .where(eq(skills.id, id));
        return skill;
      }),

    create: ({
      slug,
      name,
      domain,
      featured,
    }: SkillInput): Promise<Result<SaveOutcome>> =>
      runQuery("skills.admin_save_failed", async () => {
        const [counted] = await db.select({ total: count() }).from(skills);
        // The public read stops there: one more would never show.
        if ((counted?.total ?? 0) >= MAX_SKILLS) {
          return { status: "full" } as const;
        }
        if (await isSlugTaken(slug)) {
          return { status: "conflict", field: "slug" } as const;
        }
        const [row] = await db
          .insert(skills)
          .values({ slug, name, domain, featured, sortOrder: endOf(domain) })
          .returning({ id: skills.id });
        return row === undefined
          ? ({ status: "conflict", field: "slug" } as const)
          : ({ status: "saved", id: row.id, isNew: true } as const);
      }),

    /** A skill moved to another domain goes to its end. */
    update: (
      id: string,
      { slug, name, domain, featured }: SkillInput,
    ): Promise<Result<SaveOutcome>> =>
      runQuery("skills.admin_save_failed", async () => {
        // Gone first: a deleted skill is not "a taken slug".
        const [existing] = await db
          .select({ id: skills.id })
          .from(skills)
          .where(eq(skills.id, id));
        if (existing === undefined) {
          return { status: "not_found" } as const;
        }
        if (await isSlugTaken(slug, id)) {
          return { status: "conflict", field: "slug" } as const;
        }
        const rows = await db
          .update(skills)
          .set({
            slug,
            name,
            featured,
            sortOrder: sql`case when ${skills.domain} = ${domain} then ${skills.sortOrder} else ${endOf(domain)} end`,
            domain,
          })
          .where(eq(skills.id, id))
          .returning({ id: skills.id });
        return rows.length === 0
          ? ({ status: "not_found" } as const)
          : ({ status: "saved", id, isNew: false } as const);
      }),

    /** The skills of the same domain as this one, in order. */
    siblings: (id: string): Promise<Result<readonly string[]>> =>
      runQuery("skills.admin_read_failed", async () => {
        const rows = await db
          .select({ id: skills.id })
          .from(skills)
          .where(
            sql`${skills.domain} = (select ${skills.domain} from ${skills} where ${skills.id} = ${id})`,
          )
          .orderBy(asc(skills.sortOrder), asc(skills.name));
        return rows.map((row) => row.id);
      }),

    reorder: (ids: readonly string[]): Promise<Result<void>> =>
      runQuery("skills.admin_save_failed", () =>
        reorderRows(
          db,
          {
            table: skills,
            idColumn: skills.id,
            placeColumn: skills.sortOrder,
          },
          ids,
        ),
      ),
  };
}
