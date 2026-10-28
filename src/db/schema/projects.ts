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

import { endsAfterStart, httpsOrNull, slugFormat, timestamps } from "./columns";
import { contentStatusEnum, localeEnum, skillDomainEnum } from "./enums";
import { media } from "./media";
import { skills } from "./skills";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    domain: skillDomainEnum("domain").notNull(),
    status: contentStatusEnum("status").notNull().default("draft"),
    featured: boolean("featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    repoUrl: text("repo_url"),
    demoUrl: text("demo_url"),
    coverMediaId: uuid("cover_media_id").references(() => media.id, {
      onDelete: "restrict",
    }),
    startedOn: date("started_on", { mode: "string" }),
    endedOn: date("ended_on", { mode: "string" }),
    ...timestamps,
  },
  (t) => [
    check("projects_slug_format", slugFormat(t.slug)),
    check("projects_repo_url_https", httpsOrNull(t.repoUrl)),
    check("projects_demo_url_https", httpsOrNull(t.demoUrl)),
    check("projects_dates_ordered", endsAfterStart(t.startedOn, t.endedOn)),
    index("projects_cover_media_idx").on(t.coverMediaId),
  ],
);

/** Two reading levels: the summary is for everyone, the technical part for engineers. */
export const projectTranslations = pgTable(
  "project_translations",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    title: text("title").notNull(),
    tagline: text("tagline").notNull(),
    summaryContext: text("summary_context").notNull(),
    summaryAction: text("summary_action").notNull(),
    summaryResult: text("summary_result").notNull(),
    technicalMd: text("technical_md").notNull().default(""),
    seoDescription: text("seo_description"),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.locale] })],
);

export const projectSkills = pgTable(
  "project_skills",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.skillId] }),
    index("project_skills_skill_idx").on(t.skillId),
  ],
);
