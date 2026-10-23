/**
 * Shared `view-transition-name` that pairs a project tile with its full-screen
 * view, so React morphs one into the other on navigation (ADR-0003).
 * Slugs are kebab-case, which keeps the name a valid CSS identifier.
 */
export function projectTransitionName(slug: string): string {
  return `project-${slug}`;
}
