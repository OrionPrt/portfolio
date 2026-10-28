import { asc, desc, eq } from "drizzle-orm";

import { MAX_PAGE_SIZE, MAX_SKILLS } from "@/db/limits";
import { pickTranslation, runQuery } from "@/db/query";
import {
  bentoTiles,
  certifications,
  type certificationTranslations,
  education,
  type educationTranslations,
  skills,
} from "@/db/schema";
import type { Database } from "@/db/types";
import {
  TILE_KINDS,
  type SkillDomain,
  type TileKind,
  type TileSize,
} from "@/features/content/vocabulary";
import { LOCALES, type Locale } from "@/i18n/locales";
import {
  toMediaView,
  WITH_MEDIA,
  type MediaRow,
} from "@/features/media/mappers";
import type { MediaView } from "@/features/media/types";
import type { Result } from "@/lib/result";

// One tile per kind (unique column), so the enum size bounds the layout.
const MAX_TILES = TILE_KINDS.length;

export interface SkillView {
  readonly slug: string;
  readonly name: string;
  readonly domain: SkillDomain;
  readonly featured: boolean;
}

export interface EducationView {
  readonly school: string;
  readonly location: string | null;
  readonly startedOn: string;
  readonly endedOn: string | null;
  readonly degree: string;
  readonly description: string;
  readonly isFallback: boolean;
  readonly contentLocale: Locale;
}

export interface CertificationView {
  readonly slug: string;
  readonly name: string;
  readonly issuer: string;
  readonly issuedOn: string;
  readonly expiresOn: string | null;
  readonly credentialId: string | null;
  readonly verifyUrl: string | null;
  /** Empty when no translation exists: the description is optional. */
  readonly description: string;
  /** Its badge, its text in the page's language. */
  readonly badge: MediaView | undefined;
}

export interface TileView {
  readonly kind: TileKind;
  readonly size: TileSize;
}

export interface CatalogRepository {
  listSkills(): Promise<Result<readonly SkillView[]>>;
  listEducation(locale: Locale): Promise<Result<readonly EducationView[]>>;
  listCertifications(
    locale: Locale,
  ): Promise<Result<readonly CertificationView[]>>;
  listVisibleTiles(): Promise<Result<readonly TileView[]>>;
}

type EducationRow = typeof education.$inferSelect & {
  readonly translations: readonly (typeof educationTranslations.$inferSelect)[];
};

type CertificationRow = typeof certifications.$inferSelect & {
  readonly translations: readonly (typeof certificationTranslations.$inferSelect)[];
  readonly badge: MediaRow | null;
};

const WITH_TRANSLATIONS = { translations: { limit: LOCALES.length } };

function toEducationView(
  row: EducationRow,
  locale: Locale,
): EducationView | undefined {
  const translation = pickTranslation(row.translations, locale);
  if (translation === undefined) {
    return undefined;
  }
  return {
    school: row.school,
    location: row.location,
    startedOn: row.startedOn,
    endedOn: row.endedOn,
    degree: translation.value.degree,
    description: translation.value.description,
    isFallback: translation.isFallback,
    contentLocale: translation.value.locale,
  };
}

function toCertificationView(
  row: CertificationRow,
  locale: Locale,
): CertificationView {
  return {
    slug: row.slug,
    name: row.name,
    issuer: row.issuer,
    issuedOn: row.issuedOn,
    expiresOn: row.expiresOn,
    credentialId: row.credentialId,
    verifyUrl: row.verifyUrl,
    description:
      pickTranslation(row.translations, locale)?.value.description ?? "",
    badge: toMediaView(row.badge, locale),
  };
}

export function createCatalogRepository(db: Database): CatalogRepository {
  return {
    listSkills: () =>
      runQuery("skills.list_failed", () =>
        db
          .select({
            slug: skills.slug,
            name: skills.name,
            domain: skills.domain,
            featured: skills.featured,
          })
          .from(skills)
          .orderBy(asc(skills.domain), asc(skills.sortOrder), asc(skills.slug))
          .limit(MAX_SKILLS),
      ),

    listEducation: (locale) =>
      runQuery("education.list_failed", async () => {
        const rows = await db.query.education.findMany({
          orderBy: [
            desc(education.startedOn),
            asc(education.sortOrder),
            asc(education.slug),
          ],
          limit: MAX_PAGE_SIZE,
          with: WITH_TRANSLATIONS,
        });
        return rows.flatMap((row) => toEducationView(row, locale) ?? []);
      }),

    listCertifications: (locale) =>
      runQuery("certifications.list_failed", async () => {
        const rows = await db.query.certifications.findMany({
          orderBy: [desc(certifications.issuedOn), asc(certifications.slug)],
          limit: MAX_PAGE_SIZE,
          with: { ...WITH_TRANSLATIONS, badge: WITH_MEDIA },
        });
        return rows.map((row) => toCertificationView(row, locale));
      }),

    listVisibleTiles: () =>
      runQuery("bento.list_failed", () =>
        db
          .select({ kind: bentoTiles.kind, size: bentoTiles.size })
          .from(bentoTiles)
          .where(eq(bentoTiles.visible, true))
          .orderBy(asc(bentoTiles.sortOrder), asc(bentoTiles.kind))
          .limit(MAX_TILES),
      ),
  };
}
