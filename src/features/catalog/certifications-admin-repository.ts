import { and, asc, count, desc, eq, notInArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { MAX_PAGE_SIZE } from "@/db/limits";
import { alongside } from "@/db/one-statement";
import { runQuery } from "@/db/query";
import { certifications, certificationTranslations } from "@/db/schema";
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
import type { CertificationContent } from "@/features/content/schemas";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locales";
import type { Result } from "@/lib/result";
import { slugify } from "@/lib/slug";

const TRANSLATION_FIELDS = {
  description: certificationTranslations.description,
};

/** The language the list says how far each certification goes in. */
const ENGLISH: Locale = "en";

const FIELDS = {
  id: certifications.id,
  name: certifications.name,
  issuer: certifications.issuer,
  issuedOn: certifications.issuedOn,
  expiresOn: certifications.expiresOn,
  credentialId: certifications.credentialId,
  verifyUrl: certifications.verifyUrl,
  sortOrder: certifications.sortOrder,
};

/** A certification as the admin edits it; its slug stays out of sight. */
export type CertificationForEdit = CertificationContent & {
  readonly id: string;
};

export interface CertificationListEntry {
  readonly id: string;
  readonly name: string;
  readonly issuer: string;
  readonly issuedOn: string;
  readonly expiresOn: string | null;
  /** Past its expiry, by the database's date. */
  readonly isExpired: boolean;
  readonly english: TranslationState;
}

const NOT_FOUND = { status: "not_found" } as const;

/** A certificate's id is the owner's: a failed save logs none of its values. */
const PERSONAL = { hasPersonalData: true } as const;

/** As the site shows them: the latest first. */
const LIST_ORDER = [desc(certifications.issuedOn), asc(certifications.slug)];

/** The certification's own columns, as the admin edits them. */
function columnsOf(input: CertificationContent) {
  const { name, issuer, issuedOn, expiresOn, credentialId, verifyUrl } = input;
  return { name, issuer, issuedOn, expiresOn, credentialId, verifyUrl };
}

/** The description is optional: English is wanted where the French says something. */
const TRANSLATED = { required: [], optional: ["description"] } as const;

function translationsWrite(
  db: Database,
  certificationId: string,
  translations: CertificationContent["translations"],
) {
  return db
    .insert(certificationTranslations)
    .values(
      translationEntries(translations).map(([locale, values]) => ({
        certificationId,
        locale,
        ...values,
      })),
    )
    .onConflictDoUpdate({
      target: [
        certificationTranslations.certificationId,
        certificationTranslations.locale,
      ],
      set: proposedValues(TRANSLATION_FIELDS),
    });
}

/**
 * The certifications as the admin edits them. Not routed: the slug is drawn
 * from the name once, at creation, then kept. A save is one statement: the
 * row and its languages, together or not at all.
 */
export function createCertificationsAdminRepository(db: Database) {
  return {
    list: (): Promise<Result<readonly CertificationListEntry[]>> =>
      runQuery("certifications.admin_read_failed", async () => {
        const named = alias(certificationTranslations, "named");
        const english = alias(certificationTranslations, "english");
        const rows = await db
          .select({
            id: certifications.id,
            name: certifications.name,
            issuer: certifications.issuer,
            issuedOn: certifications.issuedOn,
            expiresOn: certifications.expiresOn,
            isExpired: sql<boolean>`coalesce(${certifications.expiresOn} < current_date, false)`,
            french: { description: named.description },
            english: { description: english.description },
          })
          .from(certifications)
          .leftJoin(
            named,
            and(
              eq(named.certificationId, certifications.id),
              eq(named.locale, DEFAULT_LOCALE),
            ),
          )
          .leftJoin(
            english,
            and(
              eq(english.certificationId, certifications.id),
              eq(english.locale, ENGLISH),
            ),
          )
          .orderBy(...LIST_ORDER)
          .limit(MAX_PAGE_SIZE);
        return rows.map(({ french, english: values, ...row }) => ({
          ...row,
          english: translationStateAgainst(
            values ?? undefined,
            french ?? undefined,
            TRANSLATED,
          ),
        }));
      }),

    find: (id: string): Promise<Result<CertificationForEdit | undefined>> =>
      runQuery("certifications.admin_read_failed", async () => {
        const [row] = await db
          .select(FIELDS)
          .from(certifications)
          .where(eq(certifications.id, id));
        if (row === undefined) {
          return undefined;
        }
        const translations = await db
          .select({
            locale: certificationTranslations.locale,
            ...TRANSLATION_FIELDS,
          })
          .from(certificationTranslations)
          .where(eq(certificationTranslations.certificationId, id))
          .limit(LOCALES.length);
        return {
          ...row,
          translations: Object.fromEntries(
            translations.map(({ locale, ...values }) => [locale, values]),
          ),
        };
      }),

    create: (input: CertificationContent): Promise<Result<SaveOutcome>> =>
      runQuery(
        "certifications.admin_save_failed",
        async () => {
          const [counted] = await db
            .select({ total: count() })
            .from(certifications);
          // The public list stops there: one more would never show.
          if ((counted?.total ?? 0) >= MAX_PAGE_SIZE) {
            return { status: "full" } as const;
          }
          const slug = await freeSlug(
            db,
            { table: certifications, slugColumn: certifications.slug },
            slugify(input.name),
          );
          const id = crypto.randomUUID();
          await db
            .with(
              ...alongside(db, [translationsWrite(db, id, input.translations)]),
            )
            .insert(certifications)
            .values({ id, slug, ...columnsOf(input) });
          return { status: "saved", id, isNew: true } as const;
        },
        PERSONAL,
      ),

    /** The languages become the ones sent; a language left out is removed, and returned. */
    update: (
      id: string,
      input: CertificationContent,
    ): Promise<Result<SaveOutcome>> =>
      runQuery(
        "certifications.admin_save_failed",
        async () => {
          const [existing] = await db
            .select({ id: certifications.id })
            .from(certifications)
            .where(eq(certifications.id, id));
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
                  .update(certifications)
                  .set(columnsOf(input))
                  .where(eq(certifications.id, id)),
                translationsWrite(db, id, input.translations),
              ]),
            )
            .delete(certificationTranslations)
            .where(
              and(
                eq(certificationTranslations.certificationId, id),
                notInArray(certificationTranslations.locale, kept),
              ),
            )
            .returning({
              locale: certificationTranslations.locale,
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
        },
        PERSONAL,
      ),
  };
}
