import { withDatabase } from "@/db/client";
import { createExperienceRepository } from "@/features/experiences/repository";
import { createProjectRepository } from "@/features/projects/repository";
import { ok, type Result } from "@/lib/result";

import { createRedirectsRepository } from "./redirects-repository";
import type { SlugLists } from "./slug-registry";

/** Every published slug, by collection, and the redirects: one round trip per list. */
export function loadPublishedSlugs(): Promise<Result<SlugLists>> {
  return withDatabase(async (db) => {
    const [projects, experiences, redirects] = await Promise.all([
      createProjectRepository(db).listPublishedSlugs(),
      createExperienceRepository(db).listPublishedSlugs(),
      createRedirectsRepository(db).list(),
    ]);
    if (!projects.ok) {
      return projects;
    }
    if (!experiences.ok) {
      return experiences;
    }
    if (!redirects.ok) {
      return redirects;
    }
    return ok({
      published: { projects: projects.data, experiences: experiences.data },
      redirects: redirects.data,
    });
  });
}
