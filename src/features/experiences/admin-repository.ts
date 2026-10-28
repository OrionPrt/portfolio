import { and, asc, count, desc, eq, ne, notInArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { MAX_LINKED_SKILLS, MAX_SLUGS } from "@/db/limits";
import { alongside } from "@/db/one-statement";
import { runQuery } from "@/db/query";
import {
  experiences,
  experienceSkills,
  experienceTranslations,
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
import type { ExperienceInput } from "@/features/content/schemas";
import type { ContentStatus } from "@/features/content/vocabulary";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locales";
import type { Result } from "@/lib/result";

const TRANSLATION_FIELDS = {
  role: experienceTranslations.role,
  summaryContext: experienceTranslations.summaryContext,
  summaryAction: experienceTranslations.summaryAction,
  summaryResult: experienceTranslations.summaryResult,
  technicalMd: experienceTranslations.technicalMd,
};

/** What the site needs of a translation to show it whole. */
const REQUIRED = [
  "role",
  "summaryContext",
  "summaryAction",
  "summaryResult",
] as const;

/** The language the list says how far each experience goes in. */
const ENGLISH: Locale = "en";

const SKILL_LINKS: SkillLinkTable = {
  table: experienceSkills,
  entryColumn: experienceSkills.experienceId,
  skillColumn: experienceSkills.skillId,
  placeColumn: experienceSkills.sortOrder,
};

const FIELDS = {
  id: experiences.id,
  slug: experiences.slug,
  company: experiences.company,
  companyUrl: experiences.companyUrl,
  logoMediaId: experiences.logoMediaId,
  location: experiences.location,
  employmentType: experiences.employmentType,
  status: experiences.status,
  startedOn: experiences.startedOn,
  endedOn: experiences.endedOn,
  sortOrder: experiences.sortOrder,
};

/** The experience as the admin edits it: every language it has, its skills in order. */
export type ExperienceForEdit = ExperienceInput & { readonly id: string };

export interface ExperienceListEntry {
  readonly id: string;
  readonly slug: string;
  readonly status: ContentStatus;
  readonly company: string;
  /** In the default language; empty when there is none. */
  readonly role: string;
  readonly startedOn: string;
  /** Null while the position is current. */
  readonly endedOn: string | null;
  readonly english: TranslationState;
}

const CONFLICT = { status: "conflict", field: "slug" } as const;
const NOT_FOUND = { status: "not_found" } as const;

/** As the site shows them: the current position first, then the latest. */
const LIST_ORDER = [
  desc(sql`${experiences.endedOn} is null`),
  desc(experiences.startedOn),
  asc(experiences.slug),
];

/** The experience's own columns, without what it links. */
function columnsOf(input: ExperienceInput) {
  const { slug, company, companyUrl, logoMediaId, location, employmentType } =
    input;
  const { status, startedOn, endedOn } = input;
  return {
    slug,
    company,
    companyUrl,
    logoMediaId,
    location,
    employmentType,
    status,
    startedOn,
    endedOn,
  };
}

function translationsWrite(
  db: Database,
  experienceId: string,
  translations: ExperienceInput["translations"],
) {
  return db
    .insert(experienceTranslations)
    .values(
      translationEntries(translations).map(([locale, values]) => ({
        experienceId,
        locale,
        ...values,
      })),
    )
    .onConflictDoUpdate({
      target: [
        experienceTranslations.experienceId,
        experienceTranslations.locale,
      ],
      set: proposedValues(TRANSLATION_FIELDS),
    });
}

/**
 * The experiences as the admin edits them. A save is one statement: the row,
 * its languages, its skills and the redirects it leaves happen together, or
 * not at all. No order to keep: the site sorts them by date.
 */
export function createExperiencesAdminRepository(db: Database) {
  const isSlugTaken = async (slug: string, exceptId?: string) => {
    const [taken] = await db
      .select({ id: experiences.id })
      .from(experiences)
      .where(
        exceptId === undefined
          ? eq(experiences.slug, slug)
          : and(eq(experiences.slug, slug), ne(experiences.id, exceptId)),
      );
    return taken !== undefined;
  };

  /** The writes of a save besides the experience's row: what it says and links. */
  const contentWrites = (id: string, input: ExperienceInput) => [
    translationsWrite(db, id, input.translations),
    ...skillLinkWrites(SKILL_LINKS, id, input.skills),
  ];

  return {
    list: (): Promise<Result<readonly ExperienceListEntry[]>> =>
      runQuery("experiences.admin_read_failed", async () => {
        const named = alias(experienceTranslations, "named");
        const english = alias(experienceTranslations, "english");
        const rows = await db
          .select({
            id: experiences.id,
            slug: experiences.slug,
            status: experiences.status,
            company: experiences.company,
            startedOn: experiences.startedOn,
            endedOn: experiences.endedOn,
            role: named.role,
            english: {
              role: english.role,
              summaryContext: english.summaryContext,
              summaryAction: english.summaryAction,
              summaryResult: english.summaryResult,
            },
          })
          .from(experiences)
          .leftJoin(
            named,
            and(
              eq(named.experienceId, experiences.id),
              eq(named.locale, DEFAULT_LOCALE),
            ),
          )
          .leftJoin(
            english,
            and(
              eq(english.experienceId, experiences.id),
              eq(english.locale, ENGLISH),
            ),
          )
          .orderBy(...LIST_ORDER)
          .limit(MAX_SLUGS);
        return rows.map(({ role, english: values, ...row }) => ({
          ...row,
          role: role ?? "",
          english: translationState(values ?? undefined, REQUIRED),
        }));
      }),

    find: (id: string): Promise<Result<ExperienceForEdit | undefined>> =>
      runQuery("experiences.admin_read_failed", async () => {
        const [row] = await db
          .select(FIELDS)
          .from(experiences)
          .where(eq(experiences.id, id));
        if (row === undefined) {
          return undefined;
        }
        const [translations, linked] = await Promise.all([
          db
            .select({
              locale: experienceTranslations.locale,
              ...TRANSLATION_FIELDS,
            })
            .from(experienceTranslations)
            .where(eq(experienceTranslations.experienceId, id))
            .limit(LOCALES.length),
          db
            .select({ slug: skills.slug })
            .from(experienceSkills)
            .innerJoin(skills, eq(skills.id, experienceSkills.skillId))
            .where(eq(experienceSkills.experienceId, id))
            .orderBy(asc(experienceSkills.sortOrder), asc(skills.slug))
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

    create: (input: ExperienceInput): Promise<Result<SaveOutcome>> =>
      runQuery("experiences.admin_save_failed", async () => {
        const [counted] = await db.select({ total: count() }).from(experiences);
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
              ...redirectWrites(db, "experiences", undefined, input),
              ...contentWrites(id, input),
            ]),
          )
          .insert(experiences)
          .values({ id, ...columnsOf(input) });
        return {
          status: "saved",
          id,
          isNew: true,
          slugs: [input.slug],
        } as const;
      }),

    /**
     * The languages and skills become the ones sent; a language left out is
     * removed, and returned for the audit log.
     */
    update: (
      id: string,
      input: ExperienceInput,
    ): Promise<Result<SaveOutcome>> =>
      runQuery("experiences.admin_save_failed", async () => {
        // Gone first: a deleted experience is not "a taken slug".
        const [before] = await db
          .select({ slug: experiences.slug, status: experiences.status })
          .from(experiences)
          .where(eq(experiences.id, id));
        if (before === undefined) {
          return NOT_FOUND;
        }
        if (await isSlugTaken(input.slug, id)) {
          return CONFLICT;
        }
        const kept = translationEntries(input.translations).map(
          ([locale]) => locale,
        );
        const removed = await db
          .with(
            ...alongside(db, [
              ...redirectWrites(db, "experiences", before, input),
              db
                .update(experiences)
                .set(columnsOf(input))
                .where(eq(experiences.id, id)),
              ...contentWrites(id, input),
            ]),
          )
          .delete(experienceTranslations)
          .where(
            and(
              eq(experienceTranslations.experienceId, id),
              notInArray(experienceTranslations.locale, kept),
            ),
          )
          .returning({
            locale: experienceTranslations.locale,
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
  };
}
