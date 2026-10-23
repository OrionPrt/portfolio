import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { slugFormat } from "./columns";
import { skillDomainEnum } from "./enums";

/** Technologies and practices; names are proper nouns, so they are not translated. */
export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    domain: skillDomainEnum("domain").notNull(),
    featured: boolean("featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [check("skills_slug_format", slugFormat(t.slug))],
);
