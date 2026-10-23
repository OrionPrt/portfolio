import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { withDatabase } from "@/db/client";
import type { Locale } from "@/i18n/locales";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { Result } from "@/lib/result";

import { createProfileRepository, type ProfileView } from "./repository";

// Cached reads for the public pages. A failed read is kept for seconds only, so
// pages recover as soon as the database does. Until the admin (P6) revalidates
// these tags on save, seeded content refreshes within the hour.

export async function getProfile(
  locale: Locale,
): Promise<Result<ProfileView | undefined>> {
  "use cache";
  cacheTag(CACHE_TAGS.profile);
  const result = await withDatabase((db) =>
    createProfileRepository(db).getProfile(locale),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife("seconds");
  }
  return result;
}
