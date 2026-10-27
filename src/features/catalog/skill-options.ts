import "server-only";

import type { Database } from "@/db/types";
import type { SkillDomain } from "@/features/content/vocabulary";
import { map, type Result } from "@/lib/result";

import { createSkillsAdminRepository } from "./skills-admin-repository";

/** A skill as a picker offers it: what a choice needs, nothing more. */
export interface SkillOption {
  readonly slug: string;
  readonly name: string;
  readonly domain: SkillDomain;
}

/** The catalog, in its order, for the forms that link skills. */
export async function loadSkillOptions(
  db: Database,
): Promise<Result<readonly SkillOption[]>> {
  const listed = await createSkillsAdminRepository(db).list();
  return map(listed, (skills) =>
    skills.map(({ slug, name, domain }) => ({ slug, name, domain })),
  );
}
