import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { withDatabase } from "@/db/client";
import type { Locale } from "@/i18n/locales";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { unwrapOr, type Result } from "@/lib/result";

import { imagesToLoad, MAX_IMAGES_PER_TEXT } from "./references";
import { createMediaRepository } from "./repository";
import type { MediaById } from "./types";

// Cached reads for the public pages: see features/profile/queries.ts.

async function getCachedImages(
  ids: readonly string[],
  locale: Locale,
): Promise<Result<MediaById>> {
  "use cache";
  cacheTag(CACHE_TAGS.media);
  const result = await withDatabase((db) =>
    createMediaRepository(db).findByIds(ids, locale),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife("seconds");
  }
  return result;
}

/**
 * The library's images a Markdown text shows, for its page: the first 30.
 * Unreadable, the text shows their descriptions instead.
 */
export async function getMarkdownImages(
  markdown: string,
  locale: Locale,
): Promise<MediaById> {
  const ids = imagesToLoad(markdown, MAX_IMAGES_PER_TEXT);
  if (ids.length === 0) {
    return {};
  }
  return unwrapOr(await getCachedImages(ids, locale), {});
}
