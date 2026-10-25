import { asc, eq } from "drizzle-orm";

import { pickTranslation, runQuery } from "@/db/query";
import { socialLinks } from "@/db/schema";
import type { Database } from "@/db/types";
import { SOCIAL_KINDS, type SocialKind } from "@/features/content/vocabulary";
import { LOCALES, type Locale } from "@/i18n/locales";
import type { Result } from "@/lib/result";

export interface SocialLinkView {
  readonly kind: SocialKind;
  readonly url: string;
}

export interface ProfileView {
  readonly displayName: string;
  readonly location: string | null;
  readonly headline: string;
  readonly availability: string;
  readonly pitch: string;
  readonly aboutMd: string;
  readonly lookingFor: string | null;
  readonly socialLinks: readonly SocialLinkView[];
  readonly isFallback: boolean;
  readonly contentLocale: Locale;
}

// One link per kind (unique column), so the enum size bounds the list.
const MAX_SOCIAL_LINKS = SOCIAL_KINDS.length;

export interface ProfileRepository {
  /** Undefined until the profile is seeded. */
  getProfile(locale: Locale): Promise<Result<ProfileView | undefined>>;
}

export function createProfileRepository(db: Database): ProfileRepository {
  return {
    getProfile: (locale) =>
      runQuery("profile.get_failed", async () => {
        const [row, links] = await Promise.all([
          db.query.profile.findFirst({
            with: { translations: { limit: LOCALES.length } },
          }),
          db
            .select({ kind: socialLinks.kind, url: socialLinks.url })
            .from(socialLinks)
            .where(eq(socialLinks.visible, true))
            .orderBy(asc(socialLinks.sortOrder), asc(socialLinks.kind))
            .limit(MAX_SOCIAL_LINKS),
        ]);
        const translation =
          row === undefined
            ? undefined
            : pickTranslation(row.translations, locale);
        if (row === undefined || translation === undefined) {
          return undefined;
        }
        const { value } = translation;
        return {
          displayName: row.displayName,
          location: row.location,
          headline: value.headline,
          availability: value.availability,
          pitch: value.pitch,
          aboutMd: value.aboutMd,
          lookingFor: value.lookingFor,
          socialLinks: links,
          isFallback: translation.isFallback,
          contentLocale: value.locale,
        };
      }),
  };
}
