import {
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
import { contentStatusEnum, employmentTypeEnum, localeEnum } from "./enums";
import { skills } from "./skills";

export const experiences = pgTable(
  "experiences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    company: text("company").notNull(),
    companyUrl: text("company_url"),
    location: text("location"),
    employmentType: employmentTypeEnum("employment_type").notNull(),
    status: contentStatusEnum("status").notNull().default("draft"),
    startedOn: date("started_on", { mode: "string" }).notNull(),
    // Null while the position is current.
    endedOn: date("ended_on", { mode: "string" }),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check("experiences_slug_format", slugFormat(t.slug)),
    check("experiences_company_url_https", httpsOrNull(t.companyUrl)),
    check("experiences_dates_ordered", endsAfterStart(t.startedOn, t.endedOn)),
  ],
);

export const experienceTranslations = pgTable(
  "experience_translations",
  {
    experienceId: uuid("experience_id")
      .notNull()
      .references(() => experiences.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    role: text("role").notNull(),
    summaryContext: text("summary_context").notNull(),
    summaryAction: text("summary_action").notNull(),
    summaryResult: text("summary_result").notNull(),
    technicalMd: text("technical_md").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.experienceId, t.locale] })],
);

export const experienceSkills = pgTable(
  "experience_skills",
  {
    experienceId: uuid("experience_id")
      .notNull()
      .references(() => experiences.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.experienceId, t.skillId] }),
    index("experience_skills_skill_idx").on(t.skillId),
  ],
);
