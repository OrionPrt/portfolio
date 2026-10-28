import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { withDatabase } from "@/db/client";
import { MAX_PAGE_SIZE } from "@/db/limits";
import type { Locale } from "@/i18n/locales";
import { CACHE_TAGS, experienceTag } from "@/lib/cache-tags";
import { ok, type Result } from "@/lib/result";
import { isSlug } from "@/lib/slug";

import { createExperienceRepository, type ExperienceView } from "./repository";

// Cached reads for the public pages: see features/profile/queries.ts.

export async function getPublishedExperiences(
  locale: Locale,
): Promise<Result<readonly ExperienceView[]>> {
  "use cache";
  cacheTag(CACHE_TAGS.experiences, CACHE_TAGS.skills, CACHE_TAGS.media);
  const result = await withDatabase((db) =>
    createExperienceRepository(db).listPublished(locale, {
      limit: MAX_PAGE_SIZE,
    }),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife("seconds");
  }
  return result;
}

export async function getCurrentExperience(
  locale: Locale,
): Promise<Result<ExperienceView | undefined>> {
  "use cache";
  cacheTag(CACHE_TAGS.experiences, CACHE_TAGS.skills, CACHE_TAGS.media);
  const result = await withDatabase((db) =>
    createExperienceRepository(db).findCurrent(locale),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife("seconds");
  }
  return result;
}

async function getCachedExperience(
  slug: string,
  locale: Locale,
): Promise<Result<ExperienceView | undefined>> {
  "use cache";
  cacheTag(experienceTag(slug), CACHE_TAGS.skills, CACHE_TAGS.media);
  const result = await withDatabase((db) =>
    createExperienceRepository(db).findPublishedBySlug(slug, locale),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife("seconds");
  }
  return result;
}

/** Checked against the cached slug list first: see getPublishedProject. */
export async function getPublishedExperience(
  slug: string,
  locale: Locale,
): Promise<Result<ExperienceView | undefined>> {
  if (!isSlug(slug)) {
    return ok(undefined);
  }
  const slugs = await getPublishedExperienceSlugs();
  if (!slugs.ok) {
    return slugs;
  }
  return slugs.data.includes(slug)
    ? getCachedExperience(slug, locale)
    : ok(undefined);
}

export async function getPublishedExperienceSlugs(): Promise<
  Result<readonly string[]>
> {
  "use cache";
  cacheTag(CACHE_TAGS.experiences);
  const result = await withDatabase((db) =>
    createExperienceRepository(db).listPublishedSlugs(),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife("seconds");
  }
  return result;
}
