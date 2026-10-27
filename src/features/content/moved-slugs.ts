import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache-tags";
import type { Result } from "@/lib/result";
import { isSlug } from "@/lib/slug";

import { loadPublishedSlugs } from "./published-slugs";
import { resolveSlug, type SlugLists } from "./slug-registry";
import type { EntryCollection } from "./vocabulary";

/** The proxy's lists, cached for the pages: a save expires them with its entries' tags. */
async function getSlugLists(): Promise<Result<SlugLists>> {
  "use cache";
  cacheTag(CACHE_TAGS.projects, CACHE_TAGS.experiences);
  const result = await loadPublishedSlugs();
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife("seconds");
  }
  return result;
}

/**
 * Where a renamed entry's old slug now leads, for its page: the proxy's own
 * lists trust a load for a minute, and until they catch up with a rename the
 * old address reaches the page instead of the 301. The page is streamed by
 * then, so its redirect is a meta refresh, which browsers follow at once.
 * Undefined when it leads nowhere, or when the lists cannot be read (the page
 * then shows "not found").
 */
export async function movedSlug(
  collection: EntryCollection,
  slug: string,
): Promise<string | undefined> {
  if (!isSlug(slug)) {
    return undefined;
  }
  const lists = await getSlugLists();
  if (!lists.ok) {
    return undefined;
  }
  const resolution = resolveSlug(lists.data, collection, slug);
  return resolution.kind === "redirect" ? resolution.to : undefined;
}
