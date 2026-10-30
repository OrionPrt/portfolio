import { SEED_CONTENT } from "../../scripts/seed/content";

// The suite reads a database seeded with scripts/seed/content.ts (CI: a fresh
// Postgres; locally: DATABASE_URL). Expectations come from that content, so
// editing it never breaks a test.

const featured = SEED_CONTENT.projects.find(
  (project) => project.featured === true && project.status === "published",
);
if (featured === undefined) {
  throw new Error("The seed content must feature a published project.");
}
const frenchTitle = featured.translations.fr?.title;
if (frenchTitle === undefined) {
  throw new Error("The featured project needs a French title.");
}

export const FEATURED_PROJECT = {
  slug: featured.slug,
  title: {
    fr: frenchTitle,
    en: featured.translations.en?.title ?? frenchTitle,
  },
  firstSkill: featured.skills?.[0],
} as const;

export const OWNER_NAME = SEED_CONTENT.profile.displayName;

/** Every public page in French, for checks that apply to all of them. */
export const FRENCH_PAGES = [
  ["home", "/fr"],
  ["about", "/fr/a-propos"],
  ["skills", "/fr/competences"],
  ["projects", "/fr/projets"],
  ["project", `/fr/projets/${FEATURED_PROJECT.slug}`],
  ["experiences", "/fr/experiences"],
  ["blog", "/fr/blog"],
  ["contact", "/fr/contact"],
] as const;
