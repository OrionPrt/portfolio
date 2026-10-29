import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { withDatabase } from "@/db/client";
import type { Locale } from "@/i18n/locales";
import { failedReadLife } from "@/lib/cache-life";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { Result } from "@/lib/result";

import {
  createCatalogRepository,
  type CertificationView,
  type EducationView,
  type SkillView,
  type TileView,
} from "./repository";

// Cached reads for the public pages: see features/profile/queries.ts.

export async function getSkills(): Promise<Result<readonly SkillView[]>> {
  "use cache";
  cacheTag(CACHE_TAGS.skills);
  const result = await withDatabase((db) =>
    createCatalogRepository(db).listSkills(),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife(failedReadLife());
  }
  return result;
}

export async function getEducation(
  locale: Locale,
): Promise<Result<readonly EducationView[]>> {
  "use cache";
  // The logos too: an image replaced or removed shows at once.
  cacheTag(CACHE_TAGS.education, CACHE_TAGS.media);
  const result = await withDatabase((db) =>
    createCatalogRepository(db).listEducation(locale),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife(failedReadLife());
  }
  return result;
}

export async function getCertifications(
  locale: Locale,
): Promise<Result<readonly CertificationView[]>> {
  "use cache";
  cacheTag(CACHE_TAGS.certifications, CACHE_TAGS.media);
  const result = await withDatabase((db) =>
    createCatalogRepository(db).listCertifications(locale),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife(failedReadLife());
  }
  return result;
}

export async function getBentoTiles(): Promise<Result<readonly TileView[]>> {
  "use cache";
  cacheTag(CACHE_TAGS.bento);
  const result = await withDatabase((db) =>
    createCatalogRepository(db).listVisibleTiles(),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife(failedReadLife());
  }
  return result;
}
