import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { MAX_LINKED_SKILLS, MAX_SLUGS } from "@/db/limits";
import {
  pickTranslation,
  runQuery,
  toPage,
  type PageRequest,
} from "@/db/query";
import {
  experiences,
  experienceSkills,
  experienceTranslations,
  type skills,
} from "@/db/schema";
import type { Database } from "@/db/types";
import { toSkillRefs, toStorySummary } from "@/features/content/mappers";
import type { SkillRef, StorySummary } from "@/features/content/types";
import {
  toMediaView,
  WITH_MEDIA,
  type MediaRow,
} from "@/features/media/mappers";
import type { MediaView } from "@/features/media/types";
import { LOCALES, type Locale } from "@/i18n/locales";
import type { Result } from "@/lib/result";

export interface ExperienceView {
  readonly slug: string;
  readonly company: string;
  readonly companyUrl: string | null;
  readonly location: string | null;
  readonly employmentType: (typeof experiences.$inferSelect)["employmentType"];
  readonly startedOn: string;
  readonly endedOn: string | null;
  readonly isCurrent: boolean;
  readonly role: string;
  readonly summary: StorySummary;
  readonly technicalMd: string;
  readonly skills: readonly SkillRef[];
  /** The company's logo, its text in the page's language. */
  readonly logo: MediaView | undefined;
  readonly isFallback: boolean;
  readonly contentLocale: Locale;
}

type ExperienceRow = typeof experiences.$inferSelect & {
  readonly translations: readonly (typeof experienceTranslations.$inferSelect)[];
  readonly skills: readonly { readonly skill: typeof skills.$inferSelect }[];
  readonly logo: MediaRow | null;
};

const WITH_CONTENT = {
  translations: { limit: LOCALES.length },
  skills: {
    orderBy: [asc(experienceSkills.sortOrder), asc(experienceSkills.skillId)],
    limit: MAX_LINKED_SKILLS,
    with: { skill: true as const },
  },
  logo: WITH_MEDIA,
};

// Same rule as projects: a published experience without any translation has
// no page, so it is left out everywhere.
const PUBLISHED = and(
  eq(experiences.status, "published"),
  sql`exists (select 1 from ${experienceTranslations} as "t" where "t".${sql.identifier(experienceTranslations.experienceId.name)} = ${experiences.id})`,
);
// Current position first, then the most recent.
const DISPLAY_ORDER = [
  desc(sql`${experiences.endedOn} is null`),
  desc(experiences.startedOn),
  asc(experiences.slug),
];

function toExperienceView(
  row: ExperienceRow,
  locale: Locale,
): ExperienceView | undefined {
  const translation = pickTranslation(row.translations, locale);
  if (translation === undefined) {
    return undefined;
  }
  return {
    slug: row.slug,
    company: row.company,
    companyUrl: row.companyUrl,
    location: row.location,
    employmentType: row.employmentType,
    startedOn: row.startedOn,
    endedOn: row.endedOn,
    isCurrent: row.endedOn === null,
    role: translation.value.role,
    summary: toStorySummary(translation.value),
    technicalMd: translation.value.technicalMd,
    skills: toSkillRefs(row.skills),
    logo: toMediaView(row.logo, locale),
    isFallback: translation.isFallback,
    contentLocale: translation.value.locale,
  };
}

export interface ExperienceRepository {
  listPublished(
    locale: Locale,
    request?: PageRequest,
  ): Promise<Result<readonly ExperienceView[]>>;
  findCurrent(locale: Locale): Promise<Result<ExperienceView | undefined>>;
  findPublishedBySlug(
    slug: string,
    locale: Locale,
  ): Promise<Result<ExperienceView | undefined>>;
  listPublishedSlugs(): Promise<Result<readonly string[]>>;
}

export function createExperienceRepository(db: Database): ExperienceRepository {
  const findOne = async (where: ReturnType<typeof and>, locale: Locale) => {
    const row = await db.query.experiences.findFirst({
      where,
      orderBy: DISPLAY_ORDER,
      with: WITH_CONTENT,
    });
    return row === undefined ? undefined : toExperienceView(row, locale);
  };

  return {
    listPublished: (locale, request) => {
      const page = toPage(request);
      return runQuery("experiences.list_failed", async () => {
        const rows = await db.query.experiences.findMany({
          where: PUBLISHED,
          orderBy: DISPLAY_ORDER,
          limit: page.limit,
          offset: page.offset,
          with: WITH_CONTENT,
        });
        return rows.flatMap((row) => toExperienceView(row, locale) ?? []);
      });
    },

    findCurrent: (locale) =>
      runQuery("experiences.current_failed", () =>
        findOne(and(PUBLISHED, isNull(experiences.endedOn)), locale),
      ),

    findPublishedBySlug: (slug, locale) =>
      runQuery("experiences.find_failed", () =>
        findOne(and(PUBLISHED, eq(experiences.slug, slug)), locale),
      ),

    listPublishedSlugs: () =>
      runQuery("experiences.slugs_failed", async () => {
        const rows = await db
          .select({ slug: experiences.slug })
          .from(experiences)
          .where(PUBLISHED)
          .orderBy(asc(experiences.slug))
          .limit(MAX_SLUGS);
        return rows.map((row) => row.slug);
      }),
  };
}
