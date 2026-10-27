// Closed lists shared by the database enums and the Zod schemas. Plain constants,
// free of Drizzle, so the schemas can also run in the browser (admin forms, P6).
// Postgres orders an enum by declaration: keep the display order here.

export const SKILL_DOMAINS = ["web", "low_level", "devops", "cyber"] as const;

export const CONTENT_STATUSES = ["draft", "published"] as const;

export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "internship",
  "apprenticeship",
  "freelance",
] as const;

export const SOCIAL_KINDS = [
  "github",
  "linkedin",
  "email",
  "hackthebox",
  "rootme",
  "tryhackme",
  "website",
] as const;

export const TILE_KINDS = [
  "identity",
  "featured_project",
  "current_experience",
  "stack",
  "cyber_stats",
  "latest_post",
  "certifications",
  "cv",
  "contact",
] as const;

export const TILE_SIZES = ["sm", "md", "lg", "xl"] as const;

export const MESSAGE_STATUSES = ["unread", "read", "archived"] as const;

/** Collections whose entries live under /<collection>/[slug]: they have slugs to redirect. */
export const ENTRY_COLLECTIONS = ["projects", "experiences"] as const;

export type SkillDomain = (typeof SKILL_DOMAINS)[number];
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export type EntryCollection = (typeof ENTRY_COLLECTIONS)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type SocialKind = (typeof SOCIAL_KINDS)[number];
export type TileKind = (typeof TILE_KINDS)[number];
export type TileSize = (typeof TILE_SIZES)[number];
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];
