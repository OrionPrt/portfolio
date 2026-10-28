import { and, asc, count, desc, eq, notInArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { MAX_PAGE_SIZE } from "@/db/limits";
import { alongside } from "@/db/one-statement";
import { runQuery } from "@/db/query";
import { education, educationTranslations } from "@/db/schema";
import type { Database } from "@/db/types";
import {
  translationStateAgainst,
  type TranslationState,
} from "@/features/admin/completeness";
import {
  proposedValues,
  translationEntries,
} from "@/features/admin/entry-writes";
import { freeSlug } from "@/features/admin/free-slug";
import type { SaveOutcome } from "@/features/admin/save-content";
import type { EducationContent } from "@/features/content/schemas";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locales";
import type { Result } from "@/lib/result";
import { slugify } from "@/lib/slug";

const TRANSLATION_FIELDS = {
  degree: educationTranslations.degree,
  description: educationTranslations.description,
};

/** What a translation needs: the degree, and the description once the French has one. */
const TRANSLATED = { required: ["degree"], optional: ["description"] } as const;

/** The language the list says how far each entry goes in. */
const ENGLISH: Locale = "en";

const FIELDS = {
  id: education.id,
  school: education.school,
  location: education.location,
  logoMediaId: education.logoMediaId,
  startedOn: education.startedOn,
  endedOn: education.endedOn,
  sortOrder: education.sortOrder,
};

/** An entry as the admin edits it: every language it has; its slug stays out of sight. */
export type EducationForEdit = EducationContent & { readonly id: string };

export interface EducationListEntry {
  readonly id: string;
  readonly school: string;
  /** In the default language; empty when there is none. */
  readonly degree: string;
  readonly startedOn: string;
  /** Null while still under way. */
  readonly endedOn: string | null;
  readonly english: TranslationState;
}

const NOT_FOUND = { status: "not_found" } as const;

/** As the site shows them: the latest first. */
const LIST_ORDER = [
  desc(education.startedOn),
  asc(education.sortOrder),
  asc(education.slug),
];

/** The entry's own columns, as the admin edits them. */
function columnsOf(input: EducationContent) {
  const { school, location, logoMediaId, startedOn, endedOn } = input;
  return { school, location, logoMediaId, startedOn, endedOn };
}

function translationsWrite(
  db: Database,
  educationId: string,
  translations: EducationContent["translations"],
) {
  return db
    .insert(educationTranslations)
    .values(
      translationEntries(translations).map(([locale, values]) => ({
        educationId,
        locale,
        ...values,
      })),
    )
    .onConflictDoUpdate({
      target: [educationTranslations.educationId, educationTranslations.locale],
      set: proposedValues(TRANSLATION_FIELDS),
    });
}

/**
 * The education entries as the admin edits them. Not routed: the slug is
 * drawn from the school and the degree once, at creation, then kept. A save
 * is one statement: the row and its languages, together or not at all.
 */
export function createEducationAdminRepository(db: Database) {
  return {
    list: (): Promise<Result<readonly EducationListEntry[]>> =>
      runQuery("education.admin_read_failed", async () => {
        const named = alias(educationTranslations, "named");
        const english = alias(educationTranslations, "english");
        const rows = await db
          .select({
            id: education.id,
            school: education.school,
            startedOn: education.startedOn,
            endedOn: education.endedOn,
            french: {
              degree: named.degree,
              description: named.description,
            },
            english: {
              degree: english.degree,
              description: english.description,
            },
          })
          .from(education)
          .leftJoin(
            named,
            and(
              eq(named.educationId, education.id),
              eq(named.locale, DEFAULT_LOCALE),
            ),
          )
          .leftJoin(
            english,
            and(
              eq(english.educationId, education.id),
              eq(english.locale, ENGLISH),
            ),
          )
          .orderBy(...LIST_ORDER)
          .limit(MAX_PAGE_SIZE);
        return rows.map(({ french, english: values, ...row }) => ({
          ...row,
          degree: french?.degree ?? "",
          english: translationStateAgainst(
            values ?? undefined,
            french ?? undefined,
            TRANSLATED,
          ),
        }));
      }),

    find: (id: string): Promise<Result<EducationForEdit | undefined>> =>
      runQuery("education.admin_read_failed", async () => {
        const [row] = await db
          .select(FIELDS)
          .from(education)
          .where(eq(education.id, id));
        if (row === undefined) {
          return undefined;
        }
        const translations = await db
          .select({
            locale: educationTranslations.locale,
            ...TRANSLATION_FIELDS,
          })
          .from(educationTranslations)
          .where(eq(educationTranslations.educationId, id))
          .limit(LOCALES.length);
        return {
          ...row,
          translations: Object.fromEntries(
            translations.map(({ locale, ...values }) => [locale, values]),
          ),
        };
      }),

    create: (input: EducationContent): Promise<Result<SaveOutcome>> =>
      runQuery("education.admin_save_failed", async () => {
        const [counted] = await db.select({ total: count() }).from(education);
        // The public list stops there: one more would never show.
        if ((counted?.total ?? 0) >= MAX_PAGE_SIZE) {
          return { status: "full" } as const;
        }
        const degree = input.translations[DEFAULT_LOCALE]?.degree ?? "";
        const slug = await freeSlug(
          db,
          { table: education, slugColumn: education.slug },
          slugify(`${input.school} ${degree}`),
        );
        const id = crypto.randomUUID();
        await db
          .with(
            ...alongside(db, [translationsWrite(db, id, input.translations)]),
          )
          .insert(education)
          .values({ id, slug, ...columnsOf(input) });
        return { status: "saved", id, isNew: true } as const;
      }),

    /** The languages become the ones sent; a language left out is removed, and returned. */
    update: (
      id: string,
      input: EducationContent,
    ): Promise<Result<SaveOutcome>> =>
      runQuery("education.admin_save_failed", async () => {
        const [existing] = await db
          .select({ id: education.id })
          .from(education)
          .where(eq(education.id, id));
        if (existing === undefined) {
          return NOT_FOUND;
        }
        const kept = translationEntries(input.translations).map(
          ([locale]) => locale,
        );
        const removed = await db
          .with(
            ...alongside(db, [
              db
                .update(education)
                .set(columnsOf(input))
                .where(eq(education.id, id)),
              translationsWrite(db, id, input.translations),
            ]),
          )
          .delete(educationTranslations)
          .where(
            and(
              eq(educationTranslations.educationId, id),
              notInArray(educationTranslations.locale, kept),
            ),
          )
          .returning({
            locale: educationTranslations.locale,
            ...TRANSLATION_FIELDS,
          });
        return {
          status: "saved",
          id,
          isNew: false,
          ...(removed.length === 0
            ? {}
            : { diff: { removedTranslations: removed } }),
        } as const;
      }),
  };
}
