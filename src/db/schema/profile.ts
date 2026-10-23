import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { httpsUrl, mailtoUrl, timestamps } from "./columns";
import { localeEnum, socialKindEnum } from "./enums";

/** A single row: the site owner. */
export const profile = pgTable(
  "profile",
  {
    id: smallint("id").primaryKey().default(1),
    displayName: text("display_name").notNull(),
    // The public email is the social link of kind "email": one place to edit it.
    location: text("location"),
    ...timestamps,
  },
  (t) => [check("profile_singleton", sql`${t.id} = 1`)],
);

export const profileTranslations = pgTable(
  "profile_translations",
  {
    profileId: smallint("profile_id")
      .notNull()
      .references(() => profile.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    headline: text("headline").notNull(),
    availability: text("availability").notNull(),
    pitch: text("pitch").notNull(),
    aboutMd: text("about_md").notNull().default(""),
    lookingFor: text("looking_for"),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.locale] })],
);

export const socialLinks = pgTable(
  "social_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: socialKindEnum("kind").notNull().unique(),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    visible: boolean("visible").notNull().default(true),
  },
  (t) => [
    // Rendered in href: mailto for the email link, https for every other kind.
    check(
      "social_links_url_scheme",
      sql`(${t.kind} = 'email' and ${mailtoUrl(t.url)}) or (${t.kind} <> 'email' and ${httpsUrl(t.url)})`,
    ),
  ],
);
