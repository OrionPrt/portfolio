import type { SkillView } from "@/features/catalog/repository";

import { SKILL_DOMAINS, type SkillDomain } from "./vocabulary";

export interface SkillGroup {
  readonly domain: SkillDomain;
  readonly skills: readonly SkillView[];
}

/** Skills by domain, in the domains' display order; empty domains are left out. */
export function groupSkillsByDomain(
  skills: readonly SkillView[],
): readonly SkillGroup[] {
  return SKILL_DOMAINS.map((domain) => ({
    domain,
    skills: skills.filter((skill) => skill.domain === domain),
  })).filter((group) => group.skills.length > 0);
}

/** The few skills a small space can show: featured first, then the rest in order. */
export function highlightSkills(
  skills: readonly SkillView[],
  limit: number,
): { readonly shown: readonly SkillView[]; readonly hidden: number } {
  const ordered = [
    ...skills.filter((skill) => skill.featured),
    ...skills.filter((skill) => !skill.featured),
  ];
  const shown = ordered.slice(0, limit);
  return { shown, hidden: skills.length - shown.length };
}
