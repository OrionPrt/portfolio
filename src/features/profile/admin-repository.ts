import { eq, notInArray } from "drizzle-orm";

import { runQuery } from "@/db/query";
import { profile, profileTranslations } from "@/db/schema";
import type { Database } from "@/db/types";
import type { ProfileInput } from "@/features/content/schemas";
import type { Locale } from "@/i18n/locales";
import type { Result } from "@/lib/result";

/** The single profile row (ADR-0004). */
export const PROFILE_ID = 1;

/** The profile as the admin edits it: every language it has. */
export type ProfileForEdit = ProfileInput;

const TRANSLATION_FIELDS = {
  headline: profileTranslations.headline,
  availability: profileTranslations.availability,
  pitch: profileTranslations.pitch,
  aboutMd: profileTranslations.aboutMd,
  lookingFor: profileTranslations.lookingFor,
};

/** A translation a save removed, as it stood. */
export type RemovedTranslation = { readonly locale: Locale } & Readonly<
  Record<keyof typeof TRANSLATION_FIELDS, string | null>
>;

export function createProfileAdminRepository(db: Database) {
  return {
    read: (): Promise<Result<ProfileForEdit | undefined>> =>
      runQuery("profile.admin_read_failed", async () => {
        const [row] = await db
          .select({
            displayName: profile.displayName,
            location: profile.location,
          })
          .from(profile)
          .where(eq(profile.id, PROFILE_ID));
        if (row === undefined) {
          return undefined;
        }
        const translations = await db
          .select({ locale: profileTranslations.locale, ...TRANSLATION_FIELDS })
          .from(profileTranslations)
          .where(eq(profileTranslations.profileId, PROFILE_ID));
        return {
          ...row,
          translations: Object.fromEntries(
            translations.map(({ locale, ...fields }) => [locale, fields]),
          ),
        };
      }),

    /**
     * Writes the profile, then each language given; a language left out is
     * removed (the site falls back to the default one), and returned for the
     * audit log's snapshot. Statement by statement (no interactive
     * transaction on Neon over HTTP): saving again completes a save cut short.
     */
    save: ({
      translations,
      ...values
    }: ProfileInput): Promise<Result<readonly RemovedTranslation[]>> =>
      runQuery("profile.admin_save_failed", async () => {
        await db
          .insert(profile)
          .values({ id: PROFILE_ID, ...values })
          .onConflictDoUpdate({ target: profile.id, set: values });
        const locales = Object.keys(translations) as Locale[];
        for (const locale of locales) {
          const translation = translations[locale];
          if (translation === undefined) {
            continue;
          }
          await db
            .insert(profileTranslations)
            .values({ profileId: PROFILE_ID, locale, ...translation })
            .onConflictDoUpdate({
              target: [
                profileTranslations.profileId,
                profileTranslations.locale,
              ],
              set: translation,
            });
        }
        return db
          .delete(profileTranslations)
          .where(notInArray(profileTranslations.locale, locales))
          .returning({
            locale: profileTranslations.locale,
            ...TRANSLATION_FIELDS,
          });
      }),
  };
}
