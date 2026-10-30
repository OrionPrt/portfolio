import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { slugFormat, timestamps } from "./columns";
import {
  contentStatusEnum,
  difficultyEnum,
  localeEnum,
  platformEnum,
  postKindEnum,
} from "./enums";
import { media } from "./media";
import { skills } from "./skills";

/**
 * Articles and write-ups. A post is written in one language or both: its
 * languages are its translations (ADR-0008). Published on a day: a later day
 * keeps it out of the site until then.
 */
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    kind: postKindEnum("kind").notNull().default("article"),
    status: contentStatusEnum("status").notNull().default("draft"),
    publishedOn: date("published_on", { mode: "string" }),
    // A write-up's challenge: where it comes from, how hard it is.
    platform: platformEnum("platform"),
    difficulty: difficultyEnum("difficulty"),
    // Platforms forbid write-ups of live challenges: retired, or allowed.
    retiredOn: date("retired_on", { mode: "string" }),
    isDisclosureAllowed: boolean("is_disclosure_allowed")
      .notNull()
      .default(false),
    coverMediaId: uuid("cover_media_id").references(() => media.id, {
      onDelete: "restrict",
    }),
    ...timestamps,
  },
  (t) => [
    check("posts_slug_format", slugFormat(t.slug)),
    check(
      "posts_published_on_set",
      sql`${t.status} <> 'published' or ${t.publishedOn} is not null`,
    ),
    check(
      "posts_writeup_platform",
      sql`${t.kind} <> 'writeup' or ${t.platform} is not null`,
    ),
    check(
      "posts_article_no_challenge",
      sql`${t.kind} = 'writeup' or (${t.platform} is null and ${t.difficulty} is null and ${t.retiredOn} is null and not ${t.isDisclosureAllowed})`,
    ),
    check(
      "posts_writeup_disclosable",
      sql`${t.status} <> 'published' or ${t.kind} <> 'writeup' or ${t.retiredOn} is not null or ${t.isDisclosureAllowed}`,
    ),
    index("posts_published_idx").on(t.status, t.publishedOn.desc()),
    index("posts_cover_media_idx").on(t.coverMediaId),
  ],
);

export const postTranslations = pgTable(
  "post_translations",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull(),
    bodyMd: text("body_md").notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.locale] })],
);

export const postSkills = pgTable(
  "post_skills",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.skillId] }),
    index("post_skills_skill_idx").on(t.skillId),
  ],
);
