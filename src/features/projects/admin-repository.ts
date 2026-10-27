import { and, asc, count, desc, eq, ne, notInArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { MAX_LINKED_SKILLS, MAX_SLUGS } from "@/db/limits";
import { alongside } from "@/db/one-statement";
import { runQuery } from "@/db/query";
import {
  projects,
  projectSkills,
  projectTranslations,
  skills,
} from "@/db/schema";
import type { Database } from "@/db/types";
import {
  translationState,
  type TranslationState,
} from "@/features/admin/completeness";
import {
  proposedValues,
  redirectWrites,
  skillLinkWrites,
  translationEntries,
  type SkillLinkTable,
} from "@/features/admin/entry-writes";
import type { SaveOutcome } from "@/features/admin/save-content";
import type { ProjectInput } from "@/features/content/schemas";
import type { ContentStatus } from "@/features/content/vocabulary";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locales";
import { reorderRows } from "@/features/admin/reorder";
import type { Result } from "@/lib/result";

const TRANSLATION_FIELDS = {
  title: projectTranslations.title,
  tagline: projectTranslations.tagline,
  summaryContext: projectTranslations.summaryContext,
  summaryAction: projectTranslations.summaryAction,
  summaryResult: projectTranslations.summaryResult,
  technicalMd: projectTranslations.technicalMd,
  seoDescription: projectTranslations.seoDescription,
};

/** What the site needs of a translation to show it whole. */
const REQUIRED = [
  "title",
  "tagline",
  "summaryContext",
  "summaryAction",
  "summaryResult",
] as const;

/** The language the list says how far each project goes in. */
const ENGLISH: Locale = "en";

const SKILL_LINKS: SkillLinkTable = {
  table: projectSkills,
  entryColumn: projectSkills.projectId,
  skillColumn: projectSkills.skillId,
  placeColumn: projectSkills.sortOrder,
};

const FIELDS = {
  id: projects.id,
  slug: projects.slug,
  domain: projects.domain,
  status: projects.status,
  featured: projects.featured,
  sortOrder: projects.sortOrder,
  repoUrl: projects.repoUrl,
  demoUrl: projects.demoUrl,
  startedOn: projects.startedOn,
  endedOn: projects.endedOn,
};

/** The project as the admin edits it: every language it has, its skills in order. */
export type ProjectForEdit = ProjectInput & { readonly id: string };

export interface ProjectListEntry {
  readonly id: string;
  readonly slug: string;
  readonly status: ContentStatus;
  readonly featured: boolean;
  /** In the default language; the slug when there is none. */
  readonly title: string;
  readonly english: TranslationState;
}

const CONFLICT = { status: "conflict", field: "slug" } as const;
const NOT_FOUND = { status: "not_found" } as const;

/** The site shows the featured projects first: each group keeps its own order. */
const LIST_ORDER = [
  desc(projects.featured),
  asc(projects.sortOrder),
  asc(projects.slug),
];

/** The next place at the end of a group. */
function endOf(featured: boolean) {
  return sql<number>`(select coalesce(max(${projects.sortOrder}) + 1, 0) from ${projects} where ${projects.featured} = ${featured})`;
}

/** The project's own columns, without what it links or how it is ordered. */
function columnsOf(input: ProjectInput) {
  const { slug, domain, status, featured, repoUrl, demoUrl } = input;
  const { startedOn, endedOn } = input;
  return {
    slug,
    domain,
    status,
    featured,
    repoUrl,
    demoUrl,
    startedOn,
    endedOn,
  };
}

function translationsWrite(
  db: Database,
  projectId: string,
  translations: ProjectInput["translations"],
) {
  return db
    .insert(projectTranslations)
    .values(
      translationEntries(translations).map(([locale, values]) => ({
        projectId,
        locale,
        ...values,
      })),
    )
    .onConflictDoUpdate({
      target: [projectTranslations.projectId, projectTranslations.locale],
      set: proposedValues(TRANSLATION_FIELDS),
    });
}

/**
 * The projects as the admin edits them. A save is one statement: the row,
 * its languages, its skills and the redirects it leaves happen together, or
 * not at all.
 */
export function createProjectsAdminRepository(db: Database) {
  const isSlugTaken = async (slug: string, exceptId?: string) => {
    const [taken] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        exceptId === undefined
          ? eq(projects.slug, slug)
          : and(eq(projects.slug, slug), ne(projects.id, exceptId)),
      );
    return taken !== undefined;
  };

  /** The writes of a save besides the project's row: what it says and links. */
  const contentWrites = (id: string, input: ProjectInput) => [
    translationsWrite(db, id, input.translations),
    ...skillLinkWrites(SKILL_LINKS, id, input.skills),
  ];

  return {
    list: (): Promise<Result<readonly ProjectListEntry[]>> =>
      runQuery("projects.admin_read_failed", async () => {
        const named = alias(projectTranslations, "named");
        const english = alias(projectTranslations, "english");
        const rows = await db
          .select({
            id: projects.id,
            slug: projects.slug,
            status: projects.status,
            featured: projects.featured,
            title: named.title,
            english: {
              title: english.title,
              tagline: english.tagline,
              summaryContext: english.summaryContext,
              summaryAction: english.summaryAction,
              summaryResult: english.summaryResult,
            },
          })
          .from(projects)
          .leftJoin(
            named,
            and(
              eq(named.projectId, projects.id),
              eq(named.locale, DEFAULT_LOCALE),
            ),
          )
          .leftJoin(
            english,
            and(
              eq(english.projectId, projects.id),
              eq(english.locale, ENGLISH),
            ),
          )
          .orderBy(...LIST_ORDER)
          .limit(MAX_SLUGS);
        return rows.map(({ title, english: values, ...row }) => ({
          ...row,
          title: title ?? row.slug,
          english: translationState(values ?? undefined, REQUIRED),
        }));
      }),

    find: (id: string): Promise<Result<ProjectForEdit | undefined>> =>
      runQuery("projects.admin_read_failed", async () => {
        const [row] = await db
          .select(FIELDS)
          .from(projects)
          .where(eq(projects.id, id));
        if (row === undefined) {
          return undefined;
        }
        const [translations, linked] = await Promise.all([
          db
            .select({
              locale: projectTranslations.locale,
              ...TRANSLATION_FIELDS,
            })
            .from(projectTranslations)
            .where(eq(projectTranslations.projectId, id))
            .limit(LOCALES.length),
          db
            .select({ slug: skills.slug })
            .from(projectSkills)
            .innerJoin(skills, eq(skills.id, projectSkills.skillId))
            .where(eq(projectSkills.projectId, id))
            .orderBy(asc(projectSkills.sortOrder), asc(skills.slug))
            .limit(MAX_LINKED_SKILLS),
        ]);
        return {
          ...row,
          skills: linked.map((skill) => skill.slug),
          translations: Object.fromEntries(
            translations.map(({ locale, ...values }) => [locale, values]),
          ),
        };
      }),

    /** At the end of its group. */
    create: (input: ProjectInput): Promise<Result<SaveOutcome>> =>
      runQuery("projects.admin_save_failed", async () => {
        const [counted] = await db.select({ total: count() }).from(projects);
        // The slug listings stop there: one more would answer 404.
        if ((counted?.total ?? 0) >= MAX_SLUGS) {
          return { status: "full" } as const;
        }
        if (await isSlugTaken(input.slug)) {
          return CONFLICT;
        }
        const id = crypto.randomUUID();
        await db
          .with(
            ...alongside(db, [
              ...redirectWrites(db, "projects", undefined, input),
              ...contentWrites(id, input),
            ]),
          )
          .insert(projects)
          .values({
            id,
            ...columnsOf(input),
            sortOrder: endOf(input.featured),
          });
        return {
          status: "saved",
          id,
          isNew: true,
          slugs: [input.slug],
        } as const;
      }),

    /**
     * The languages and skills become the ones sent; a language left out is
     * removed, and returned for the audit log. Moved to the other group, the
     * project goes to its end.
     */
    update: (id: string, input: ProjectInput): Promise<Result<SaveOutcome>> =>
      runQuery("projects.admin_save_failed", async () => {
        // Gone first: a deleted project is not "a taken slug".
        const [before] = await db
          .select({
            slug: projects.slug,
            status: projects.status,
            featured: projects.featured,
          })
          .from(projects)
          .where(eq(projects.id, id));
        if (before === undefined) {
          return NOT_FOUND;
        }
        if (await isSlugTaken(input.slug, id)) {
          return CONFLICT;
        }
        const row = db
          .update(projects)
          .set({
            ...columnsOf(input),
            ...(before.featured === input.featured
              ? {}
              : { sortOrder: endOf(input.featured) }),
          })
          .where(eq(projects.id, id));
        const kept = translationEntries(input.translations).map(
          ([locale]) => locale,
        );
        const removed = await db
          .with(
            ...alongside(db, [
              ...redirectWrites(db, "projects", before, input),
              row,
              ...contentWrites(id, input),
            ]),
          )
          .delete(projectTranslations)
          .where(
            and(
              eq(projectTranslations.projectId, id),
              notInArray(projectTranslations.locale, kept),
            ),
          )
          .returning({
            locale: projectTranslations.locale,
            ...TRANSLATION_FIELDS,
          });
        return {
          status: "saved",
          id,
          isNew: false,
          slugs:
            before.slug === input.slug
              ? [input.slug]
              : [input.slug, before.slug],
          ...(removed.length === 0
            ? {}
            : { diff: { removedTranslations: removed } }),
        } as const;
      }),

    /** The projects of the same group as this one, in order. */
    siblings: (id: string): Promise<Result<readonly string[]>> =>
      runQuery("projects.admin_read_failed", async () => {
        const rows = await db
          .select({ id: projects.id })
          .from(projects)
          .where(
            sql`${projects.featured} = (select ${projects.featured} from ${projects} where ${projects.id} = ${id})`,
          )
          .orderBy(asc(projects.sortOrder), asc(projects.slug))
          .limit(MAX_SLUGS);
        return rows.map((row) => row.id);
      }),

    reorder: (ids: readonly string[]): Promise<Result<void>> =>
      runQuery("projects.admin_save_failed", () =>
        reorderRows(
          db,
          {
            table: projects,
            idColumn: projects.id,
            placeColumn: projects.sortOrder,
          },
          ids,
        ),
      ),
  };
}
