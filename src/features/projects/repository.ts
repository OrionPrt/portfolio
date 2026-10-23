import { and, asc, desc, eq, sql } from "drizzle-orm";

import { MAX_LINKED_SKILLS, MAX_SLUGS } from "@/db/limits";
import {
  pickTranslation,
  runQuery,
  toPage,
  type PageRequest,
} from "@/db/query";
import {
  projects,
  projectSkills,
  projectTranslations,
  type skills,
} from "@/db/schema";
import type { Database } from "@/db/types";
import { toSkillRefs, toStorySummary } from "@/features/content/mappers";
import { LOCALES, type Locale } from "@/i18n/locales";
import type { Result } from "@/lib/result";

import type { ProjectView } from "./types";

type ProjectRow = typeof projects.$inferSelect & {
  readonly translations: readonly (typeof projectTranslations.$inferSelect)[];
  readonly skills: readonly { readonly skill: typeof skills.$inferSelect }[];
};

const WITH_CONTENT = {
  translations: { limit: LOCALES.length },
  skills: {
    orderBy: [asc(projectSkills.sortOrder), asc(projectSkills.skillId)],
    limit: MAX_LINKED_SKILLS,
    with: { skill: true as const },
  },
};

// A page needs a translation to show, so lists, slug listings and lookups all
// skip a published project that has none: the sitemap never lists a 404.
const PUBLISHED = and(
  eq(projects.status, "published"),
  // Drizzle's relational queries re-alias every column of a `where` to the root
  // table, so the subquery names its own columns by identifier.
  sql`exists (select 1 from ${projectTranslations} as "t" where "t".${sql.identifier(projectTranslations.projectId.name)} = ${projects.id})`,
);
const DISPLAY_ORDER = [
  desc(projects.featured),
  asc(projects.sortOrder),
  asc(projects.slug),
];

function toProjectView(
  row: ProjectRow,
  locale: Locale,
): ProjectView | undefined {
  const translation = pickTranslation(row.translations, locale);
  if (translation === undefined) {
    return undefined;
  }
  const { value } = translation;
  return {
    slug: row.slug,
    domain: row.domain,
    featured: row.featured,
    repoUrl: row.repoUrl,
    demoUrl: row.demoUrl,
    startedOn: row.startedOn,
    endedOn: row.endedOn,
    title: value.title,
    tagline: value.tagline,
    summary: toStorySummary(value),
    technicalMd: value.technicalMd,
    seoDescription: value.seoDescription,
    skills: toSkillRefs(row.skills),
    isFallback: translation.isFallback,
  };
}

export interface ProjectRepository {
  listPublished(
    locale: Locale,
    request?: PageRequest,
  ): Promise<Result<readonly ProjectView[]>>;
  findPublishedBySlug(
    slug: string,
    locale: Locale,
  ): Promise<Result<ProjectView | undefined>>;
  findFeatured(locale: Locale): Promise<Result<ProjectView | undefined>>;
  listPublishedSlugs(): Promise<Result<readonly string[]>>;
}

export function createProjectRepository(db: Database): ProjectRepository {
  return {
    listPublished: (locale, request) => {
      const page = toPage(request);
      return runQuery("projects.list_failed", async () => {
        const rows = await db.query.projects.findMany({
          where: PUBLISHED,
          orderBy: DISPLAY_ORDER,
          limit: page.limit,
          offset: page.offset,
          with: WITH_CONTENT,
        });
        return rows.flatMap((row) => toProjectView(row, locale) ?? []);
      });
    },

    findPublishedBySlug: (slug, locale) =>
      runQuery("projects.find_failed", async () => {
        const row = await db.query.projects.findFirst({
          where: and(PUBLISHED, eq(projects.slug, slug)),
          with: WITH_CONTENT,
        });
        return row === undefined ? undefined : toProjectView(row, locale);
      }),

    findFeatured: (locale) =>
      runQuery("projects.featured_failed", async () => {
        const row = await db.query.projects.findFirst({
          where: and(PUBLISHED, eq(projects.featured, true)),
          orderBy: DISPLAY_ORDER,
          with: WITH_CONTENT,
        });
        return row === undefined ? undefined : toProjectView(row, locale);
      }),

    listPublishedSlugs: () =>
      runQuery("projects.slugs_failed", async () => {
        const rows = await db
          .select({ slug: projects.slug })
          .from(projects)
          .where(PUBLISHED)
          .orderBy(asc(projects.slug))
          .limit(MAX_SLUGS);
        return rows.map((row) => row.slug);
      }),
  };
}
