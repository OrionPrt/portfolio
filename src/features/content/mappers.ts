import type { SkillRef, StorySummary } from "./types";

interface SummaryColumns {
  readonly summaryContext: string;
  readonly summaryAction: string;
  readonly summaryResult: string;
}

export function toStorySummary(translation: SummaryColumns): StorySummary {
  return {
    context: translation.summaryContext,
    action: translation.summaryAction,
    result: translation.summaryResult,
  };
}

export function toSkillRefs(
  links: readonly { readonly skill: SkillRef }[],
): readonly SkillRef[] {
  return links.map(({ skill }) => ({ slug: skill.slug, name: skill.name }));
}
