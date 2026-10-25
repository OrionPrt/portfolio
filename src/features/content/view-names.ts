import type { Locale } from "@/i18n/locales";

// Shared `view-transition-name`s pair a hub tile with its full-screen view, so
// React morphs one into the other on navigation (ADR-0003). Slugs are
// kebab-case, which keeps every name a valid CSS identifier.

/** Views the hub has exactly one of. */
export const VIEW_TRANSITIONS = {
  identity: "identity",
  stack: "stack",
} as const;

export function projectTransitionName(slug: string): string {
  return `project-${slug}`;
}

export function experienceTransitionName(slug: string): string {
  return `experience-${slug}`;
}

/** The id of a skill on the skills page, linked from every skill badge. */
export function skillAnchor(slug: string, locale: Locale): string {
  return `skill-${slug}-${locale}`;
}
