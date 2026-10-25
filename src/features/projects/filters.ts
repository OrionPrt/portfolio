import { z } from "zod";

import { slugSchema } from "@/features/content/schemas";
import type { SkillRef } from "@/features/content/types";
import { SKILL_DOMAINS, type SkillDomain } from "@/features/content/vocabulary";

import type { ProjectView } from "./types";

export interface ProjectFilters {
  readonly domain?: SkillDomain;
  readonly skill?: string;
}

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

// Each field is read on its own: one unusable value never discards the other.
const domainSchema = z.enum(SKILL_DOMAINS);

/** The filters of the projects page, from its URL (a plain GET form). */
export function parseProjectFilters(
  searchParams: SearchParams,
): ProjectFilters {
  const domain = domainSchema.safeParse(searchParams.domain);
  const skill = slugSchema.safeParse(searchParams.skill);
  return {
    ...(domain.success ? { domain: domain.data } : {}),
    ...(skill.success ? { skill: skill.data } : {}),
  };
}

export function filterProjects(
  projects: readonly ProjectView[],
  { domain, skill }: ProjectFilters,
): readonly ProjectView[] {
  return projects.filter(
    (project) =>
      (domain === undefined || project.domain === domain) &&
      (skill === undefined || project.skills.some((s) => s.slug === skill)),
  );
}

/** The skills worth filtering on: those at least one project uses. */
export function skillsUsedBy(
  projects: readonly ProjectView[],
): readonly SkillRef[] {
  const bySlug = new Map(
    projects.flatMap((project) => project.skills).map((s) => [s.slug, s]),
  );
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}
