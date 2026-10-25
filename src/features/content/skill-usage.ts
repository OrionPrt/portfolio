import type { Locale } from "@/i18n/locales";

import type { SkillRef } from "./types";

interface UsesSkills {
  readonly slug: string;
  readonly skills: readonly SkillRef[];
  readonly isFallback?: boolean;
  readonly contentLocale?: Locale;
}

export interface SkillUsage {
  readonly projects: readonly {
    readonly slug: string;
    readonly title: string;
    /** Set when the title falls back to another language. */
    readonly lang?: Locale;
  }[];
  readonly experiences: readonly {
    readonly slug: string;
    readonly role: string;
    readonly company: string;
    readonly lang?: Locale;
  }[];
}

/** The language to mark on a fallback title, if any. */
function fallbackLang(entry: UsesSkills): { readonly lang?: Locale } {
  return entry.isFallback === true && entry.contentLocale !== undefined
    ? { lang: entry.contentLocale }
    : {};
}

/** Where each skill was used, keyed by skill slug: the skills page links them. */
export function skillUsage(
  projects: readonly (UsesSkills & { readonly title: string })[],
  experiences: readonly (UsesSkills & {
    readonly role: string;
    readonly company: string;
  })[],
): ReadonlyMap<string, SkillUsage> {
  const usage = new Map<string, SkillUsage>();
  const entry = (slug: string): SkillUsage =>
    usage.get(slug) ?? { projects: [], experiences: [] };

  for (const project of projects) {
    const used = {
      slug: project.slug,
      title: project.title,
      ...fallbackLang(project),
    };
    for (const skill of project.skills) {
      const current = entry(skill.slug);
      usage.set(skill.slug, {
        ...current,
        projects: [...current.projects, used],
      });
    }
  }
  for (const experience of experiences) {
    const used = {
      slug: experience.slug,
      role: experience.role,
      company: experience.company,
      ...fallbackLang(experience),
    };
    for (const skill of experience.skills) {
      const current = entry(skill.slug);
      usage.set(skill.slug, {
        ...current,
        experiences: [...current.experiences, used],
      });
    }
  }
  return usage;
}
