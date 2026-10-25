import { withDatabase } from "@/db/client";
import { createExperienceRepository } from "@/features/experiences/repository";
import { createProjectRepository } from "@/features/projects/repository";
import { ok, type Result } from "@/lib/result";

import type { SlugLists } from "./slug-registry";

/** Every published slug, by collection, in one database round trip per list. */
export function loadPublishedSlugs(): Promise<Result<SlugLists>> {
  return withDatabase(async (db) => {
    const [projects, experiences] = await Promise.all([
      createProjectRepository(db).listPublishedSlugs(),
      createExperienceRepository(db).listPublishedSlugs(),
    ]);
    if (!projects.ok) {
      return projects;
    }
    if (!experiences.ok) {
      return experiences;
    }
    return ok({ projects: projects.data, experiences: experiences.data });
  });
}
