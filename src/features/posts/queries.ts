import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { withDatabase } from "@/db/client";
import { MAX_PAGE_SIZE } from "@/db/limits";
import type { Locale } from "@/i18n/locales";
import { failedReadLife } from "@/lib/cache-life";
import { CACHE_TAGS, postTag } from "@/lib/cache-tags";
import { ok, type Result } from "@/lib/result";
import { isSlug } from "@/lib/slug";

import { createPostRepository } from "./repository";
import type { PostSummary, PostView } from "./types";

// Cached reads for the public pages: see features/profile/queries.ts. A post
// whose day has not come shows once its list's entry expires (hours), or when
// a save expires it (ADR-0008).

export async function getPublishedPosts(
  locale: Locale,
): Promise<Result<readonly PostSummary[]>> {
  "use cache";
  cacheTag(CACHE_TAGS.posts, CACHE_TAGS.skills, CACHE_TAGS.media);
  const result = await withDatabase((db) =>
    createPostRepository(db).listPublished(locale, { limit: MAX_PAGE_SIZE }),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife(failedReadLife());
  }
  return result;
}

async function getCachedPost(
  slug: string,
  locale: Locale,
): Promise<Result<PostView | undefined>> {
  "use cache";
  cacheTag(postTag(slug), CACHE_TAGS.skills, CACHE_TAGS.media);
  const result = await withDatabase((db) =>
    createPostRepository(db).findPublishedBySlug(slug, locale),
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
 * entry of its own: the cache only ever holds real posts.
 */
export async function getPublishedPost(
  slug: string,
  locale: Locale,
): Promise<Result<PostView | undefined>> {
  if (!isSlug(slug)) {
    return ok(undefined);
  }
  const slugs = await getPublishedPostSlugs();
  if (!slugs.ok) {
    return slugs;
  }
  return slugs.data.includes(slug)
    ? getCachedPost(slug, locale)
    : ok(undefined);
}

export async function getLatestPost(
  locale: Locale,
): Promise<Result<PostSummary | undefined>> {
  "use cache";
  cacheTag(CACHE_TAGS.posts, CACHE_TAGS.media);
  const result = await withDatabase((db) =>
    createPostRepository(db).findLatest(locale),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife(failedReadLife());
  }
  return result;
}

export async function getPublishedPostSlugs(): Promise<
  Result<readonly string[]>
> {
  "use cache";
  cacheTag(CACHE_TAGS.posts);
  const result = await withDatabase((db) =>
    createPostRepository(db).listPublishedSlugs(),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife(failedReadLife());
  }
  return result;
}
