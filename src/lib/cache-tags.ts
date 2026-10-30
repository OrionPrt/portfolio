/**
 * Every cache tag in one place: cached reads tag their entries with these, and
 * the admin (P6) revalidates the same values after a write. A typo in a string
 * literal would silently leave stale content, hence these constants.
 */
export const CACHE_TAGS = {
  profile: "profile",
  projects: "projects",
  experiences: "experiences",
  // Also on project and experience reads, which show skill badges.
  skills: "skills",
  education: "education",
  certifications: "certifications",
  bento: "bento",
  // On every read that shows an image: an alternative text edited shows at once.
  media: "media",
} as const;

/** One project's page; `projects` covers the lists. */
export function projectTag(slug: string): string {
  return `project:${slug}`;
}

/** One experience's page; `experiences` covers the lists. */
export function experienceTag(slug: string): string {
  return `experience:${slug}`;
}
