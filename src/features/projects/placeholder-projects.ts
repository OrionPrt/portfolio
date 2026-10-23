export interface PlaceholderProject {
  readonly slug: string;
}

/**
 * Stand-in for the projects repository until the data layer lands (P2).
 * Display copy comes from the message catalogs, so it stays bilingual.
 */
export const PLACEHOLDER_PROJECTS: readonly PlaceholderProject[] = [
  { slug: "demo" },
];

export const FEATURED_PLACEHOLDER_PROJECT: PlaceholderProject = {
  slug: "demo",
};

export function findPlaceholderProject(
  slug: string,
): PlaceholderProject | undefined {
  return PLACEHOLDER_PROJECTS.find((project) => project.slug === slug);
}
