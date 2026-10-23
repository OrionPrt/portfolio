import {
  check,
  date,
  integer,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { endsAfterStart, httpsOrNull, slugFormat, timestamps } from "./columns";
import { localeEnum } from "./enums";

export const education = pgTable(
  "education",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Not routed: the natural key that lets the seed upsert a row.
    slug: text("slug").notNull().unique(),
    school: text("school").notNull(),
    location: text("location"),
    startedOn: date("started_on", { mode: "string" }).notNull(),
    endedOn: date("ended_on", { mode: "string" }),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check("education_slug_format", slugFormat(t.slug)),
    check("education_dates_ordered", endsAfterStart(t.startedOn, t.endedOn)),
  ],
);

export const educationTranslations = pgTable(
  "education_translations",
  {
    educationId: uuid("education_id")
      .notNull()
      .references(() => education.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    degree: text("degree").notNull(),
    description: text("description").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.educationId, t.locale] })],
);

export const certifications = pgTable(
  "certifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    issuer: text("issuer").notNull(),
    issuedOn: date("issued_on", { mode: "string" }).notNull(),
    expiresOn: date("expires_on", { mode: "string" }),
    credentialId: text("credential_id"),
    verifyUrl: text("verify_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check("certifications_slug_format", slugFormat(t.slug)),
    check("certifications_verify_url_https", httpsOrNull(t.verifyUrl)),
    check(
      "certifications_dates_ordered",
      endsAfterStart(t.issuedOn, t.expiresOn),
    ),
  ],
);

export const certificationTranslations = pgTable(
  "certification_translations",
  {
    certificationId: uuid("certification_id")
      .notNull()
      .references(() => certifications.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    description: text("description").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.certificationId, t.locale] })],
);
