export type { SkillDomain } from "./vocabulary";

export interface SkillRef {
  readonly slug: string;
  readonly name: string;
}

/** The "for everyone" reading level: context, then action, then outcome. */
export interface StorySummary {
  readonly context: string;
  readonly action: string;
  readonly result: string;
}
