import type {
  SkillDomain,
  SkillRef,
  StorySummary,
} from "@/features/content/types";

export interface ProjectView {
  readonly slug: string;
  readonly domain: SkillDomain;
  readonly featured: boolean;
  readonly repoUrl: string | null;
  readonly demoUrl: string | null;
  readonly startedOn: string | null;
  readonly endedOn: string | null;
  readonly title: string;
  readonly tagline: string;
  readonly summary: StorySummary;
  readonly technicalMd: string;
  readonly seoDescription: string | null;
  readonly skills: readonly SkillRef[];
  /** True when the requested language was missing and another one is shown. */
  readonly isFallback: boolean;
}
