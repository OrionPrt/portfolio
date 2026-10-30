import { CACHE_TAGS, experienceTag, projectTag } from "@/lib/cache-tags";

export type ContentEntity =
  | "profile"
  | "social_link"
  | "skill"
  | "project"
  | "experience"
  | "education"
  | "certification"
  | "bento_tile"
  | "media"
  | "platform";

export interface ContentChange {
  readonly entity: ContentEntity;
  /** The slugs whose own page changes: both, when one is renamed. */
  readonly slugs?: readonly string[];
}

const LIST_TAGS: Readonly<Record<ContentEntity, string>> = {
  // Social links are read with the profile.
  profile: CACHE_TAGS.profile,
  social_link: CACHE_TAGS.profile,
  // Project and experience reads carry `skills` too: their badges follow.
  skill: CACHE_TAGS.skills,
  project: CACHE_TAGS.projects,
  experience: CACHE_TAGS.experiences,
  education: CACHE_TAGS.education,
  certification: CACHE_TAGS.certifications,
  bento_tile: CACHE_TAGS.bento,
  media: CACHE_TAGS.media,
  platform: CACHE_TAGS.platforms,
};

/** The cache tags a change makes stale: the entity's list, and each page it has. */
export function tagsFor({
  entity,
  slugs = [],
}: ContentChange): readonly string[] {
  const pageTag =
    entity === "project"
      ? projectTag
      : entity === "experience"
        ? experienceTag
        : undefined;
  const pages = pageTag === undefined ? [] : slugs.map(pageTag);
  return [...new Set([LIST_TAGS[entity], ...pages])];
}
