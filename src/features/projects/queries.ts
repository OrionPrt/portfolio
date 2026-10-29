import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { withDatabase } from "@/db/client";
import { MAX_PAGE_SIZE } from "@/db/limits";
import type { Locale } from "@/i18n/locales";
import { failedReadLife } from "@/lib/cache-life";
import { CACHE_TAGS, projectTag } from "@/lib/cache-tags";
import { ok, type Result } from "@/lib/result";
import { isSlug } from "@/lib/slug";

import { createProjectRepository } from "./repository";
import type { ProjectView } from "./types";

// Cached reads for the public pages: see features/profile/queries.ts.

export async function getPublishedProjects(
  locale: Locale,
): Promise<Result<readonly ProjectView[]>> {
  "use cache";
  cacheTag(CACHE_TAGS.projects, CACHE_TAGS.skills, CACHE_TAGS.media);
  const result = await withDatabase((db) =>
    createProjectRepository(db).listPublished(locale, {
      limit: MAX_PAGE_SIZE,
    }),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife(failedReadLife());
  }
  return result;
}

async function getCachedProject(
  slug: string,
  locale: Locale,
): Promise<Result<ProjectView | undefined>> {
  "use cache";
  cacheTag(projectTag(slug), CACHE_TAGS.skills, CACHE_TAGS.media);
  const result = await withDatabase((db) =>
    createProjectRepository(db).findPublishedBySlug(slug, locale),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife(failedReadLife());
  }
  return result;
}

/**
 * The slug comes from the URL. It is checked against the cached list of
 * published slugs first, so an unknown one costs neither a query nor a cache
 * entry of its own: the cache only ever holds real projects.
 */
export async function getPublishedProject(
  slug: string,
  locale: Locale,
): Promise<Result<ProjectView | undefined>> {
  if (!isSlug(slug)) {
    return ok(undefined);
  }
  const slugs = await getPublishedProjectSlugs();
  if (!slugs.ok) {
    return slugs;
  }
  return slugs.data.includes(slug)
    ? getCachedProject(slug, locale)
    : ok(undefined);
}

export async function getFeaturedProject(
  locale: Locale,
): Promise<Result<ProjectView | undefined>> {
  "use cache";
  cacheTag(CACHE_TAGS.projects, CACHE_TAGS.skills, CACHE_TAGS.media);
  const result = await withDatabase((db) =>
    createProjectRepository(db).findFeatured(locale),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife(failedReadLife());
  }
  return result;
}

export async function getPublishedProjectSlugs(): Promise<
  Result<readonly string[]>
> {
  "use cache";
  cacheTag(CACHE_TAGS.projects);
  const result = await withDatabase((db) =>
    createProjectRepository(db).listPublishedSlugs(),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife(failedReadLife());
  }
  return result;
}
