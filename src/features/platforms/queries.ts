import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { withDatabase } from "@/db/client";
import { failedReadLife } from "@/lib/cache-life";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { Result } from "@/lib/result";

import { createPlatformsRepository, type PlatformView } from "./repository";

// Cached reads for the public pages: see features/profile/queries.ts.

export async function getPlatforms(): Promise<Result<readonly PlatformView[]>> {
  "use cache";
  cacheTag(CACHE_TAGS.platforms);
  const result = await withDatabase((db) =>
    createPlatformsRepository(db).list(),
  );
  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife(failedReadLife());
  }
  return result;
}
