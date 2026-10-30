import { withDatabase } from "@/db/client";
import { createExperienceRepository } from "@/features/experiences/repository";
import { createPostRepository } from "@/features/posts/repository";
import { createProjectRepository } from "@/features/projects/repository";
import { all, map, type Result } from "@/lib/result";

import { createRedirectsRepository } from "./redirects-repository";
import type { SlugLists } from "./slug-registry";

/** Every published slug, by collection, and the redirects: one round trip per list. */
export function loadPublishedSlugs(): Promise<Result<SlugLists>> {
  return withDatabase(async (db) => {
    const reads = await Promise.all([
      createProjectRepository(db).listPublishedSlugs(),
      createExperienceRepository(db).listPublishedSlugs(),
      createPostRepository(db).listPublishedSlugs(),
      createRedirectsRepository(db).list(),
    ]);
    return map(all(reads), ([projects, experiences, posts, redirects]) => ({
      published: { projects, experiences, posts },
      redirects,
    }));
  });
}
