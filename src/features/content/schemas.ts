import { z } from "zod";

import { MAX_LINKED_SKILLS } from "@/db/limits";
import { DEFAULT_LOCALE, LOCALES } from "@/i18n/locales";
import { MAX_SLUG_LENGTH, SLUG_PATTERN } from "@/lib/slug";

import { TEXT_LIMITS } from "./limits";
import {
  CONTENT_STATUSES,
  EMPLOYMENT_TYPES,
  SKILL_DOMAINS,
  SOCIAL_KINDS,
  TILE_KINDS,
  TILE_SIZES,
} from "./vocabulary";

/**
 * Input schemas for the editable content: they guard the seed now and the admin
 * forms later (P6). The database enforces the same rules as CHECK constraints
 * where it can (slug format, https links, date order); lengths live here.
 */

export { TEXT_LIMITS };

const MAX_SORT_ORDER = 10_000;

export const slugSchema = z
  .string()
  .max(MAX_SLUG_LENGTH)
  .regex(new RegExp(SLUG_PATTERN), "lower-case kebab-case only");

/**
 * The database CHECKs' patterns, or stricter: a value Zod accepts is never
 * refused there. A mailto link carries an address only, no query (subject,
 * cc, body) a visitor's mail app would fill in.
 */
const HTTPS_URL = /^https:\/\/\S+$/;
const MAILTO_URL = /^mailto:[^\s@?#]+@[^\s@?#]+$/;

/**
 * Links rendered in `href`: https only, which rules out javascript: and data:.
 * Normalized first (scheme case, surrounding spaces), and without credentials,
 * which would only serve to disguise the real host.
 */
export const httpsUrlSchema = z
  .url({ protocol: /^https$/, normalize: true })
  .max(TEXT_LIMITS.url)
  .regex(HTTPS_URL, "an https:// link without spaces")
  .refine((value) => {
    // Zod still runs refinements after a failed check: leave invalid URLs to z.url().
    if (!URL.canParse(value)) {
      return true;
    }
    const url = new URL(value);
    return url.username === "" && url.password === "";
  }, "a link without credentials");

export const mailtoUrlSchema = z
  .string()
  .trim()
  .max(TEXT_LIMITS.url)
  .regex(MAILTO_URL, "a mailto:name@domain link");

/** Social links may also open the mail client. */
export const socialUrlSchema = z.union([httpsUrlSchema, mailtoUrlSchema]);

/** A calendar day; Postgres has no year 0, and nothing here predates 1900. */
export const isoDateSchema = z.iso
  .date()
  .refine(
    (day) => day >= "1900-01-01" && day <= "2999-12-31",
    "a year from 1900 to 2999",
  );

const sortOrderSchema = z.int().min(0).max(MAX_SORT_ORDER).default(0);

function text(max: number) {
  return z.string().trim().min(1).max(max);
}

function optionalText(max: number) {
  return text(max).nullable().default(null);
}

const markdownSchema = z.string().trim().max(TEXT_LIMITS.markdown).default("");

const skillSlugsSchema = z
  .array(slugSchema)
  .max(MAX_LINKED_SKILLS)
  .refine((slugs) => new Set(slugs).size === slugs.length, "duplicate skill")
  .default([]);

/** One entry per locale; the default locale is required, the others fall back to it. */
function translationsSchema<T extends z.ZodType>(schema: T) {
  return z
    .partialRecord(z.enum(LOCALES), schema.optional())
    .refine((translations) => translations[DEFAULT_LOCALE] !== undefined, {
      message: `a "${DEFAULT_LOCALE}" translation is required`,
      path: [DEFAULT_LOCALE],
    });
}

/** ISO dates compare as strings. An end needs a start; an open end (null) is in order. */
function endsAfterStart(start: string | null, end: string | null): boolean {
  return end === null || (start !== null && end >= start);
}

/** Reported on the end date: the form shows it next to that field. */
function datesOutOfOrder(endField: string) {
  return { message: "the end date precedes the start date", path: [endField] };
}

const summaryFields = {
  summaryContext: text(TEXT_LIMITS.summary),
  summaryAction: text(TEXT_LIMITS.summary),
  summaryResult: text(TEXT_LIMITS.summary),
};

export const profileInputSchema = z.object({
  displayName: text(TEXT_LIMITS.name),
  location: optionalText(TEXT_LIMITS.name),
  translations: translationsSchema(
    z.object({
      headline: text(TEXT_LIMITS.tagline),
      availability: text(TEXT_LIMITS.tagline),
      pitch: text(TEXT_LIMITS.summary),
      aboutMd: markdownSchema,
      lookingFor: optionalText(TEXT_LIMITS.summary),
    }),
  ),
});

export const socialLinkInputSchema = z
  .object({
    kind: z.enum(SOCIAL_KINDS),
    url: socialUrlSchema,
    sortOrder: sortOrderSchema,
    visible: z.boolean().default(true),
  })
  .refine((link) => (link.kind === "email") === MAILTO_URL.test(link.url), {
    message: "the email link uses mailto:, every other kind https://",
    path: ["url"],
  });

export const skillInputSchema = z.object({
  slug: slugSchema,
  name: text(TEXT_LIMITS.name),
  domain: z.enum(SKILL_DOMAINS),
  featured: z.boolean().default(false),
  sortOrder: sortOrderSchema,
});

export const projectInputSchema = z
  .object({
    slug: slugSchema,
    domain: z.enum(SKILL_DOMAINS),
    status: z.enum(CONTENT_STATUSES).default("draft"),
    featured: z.boolean().default(false),
    sortOrder: sortOrderSchema,
    repoUrl: httpsUrlSchema.nullable().default(null),
    demoUrl: httpsUrlSchema.nullable().default(null),
    startedOn: isoDateSchema.nullable().default(null),
    endedOn: isoDateSchema.nullable().default(null),
    skills: skillSlugsSchema,
    translations: translationsSchema(
      z.object({
        title: text(TEXT_LIMITS.title),
        tagline: text(TEXT_LIMITS.tagline),
        ...summaryFields,
        technicalMd: markdownSchema,
        seoDescription: optionalText(TEXT_LIMITS.seo),
      }),
    ),
  })
  .refine(
    (p) => endsAfterStart(p.startedOn, p.endedOn),
    datesOutOfOrder("endedOn"),
  );

export const experienceInputSchema = z
  .object({
    slug: slugSchema,
    company: text(TEXT_LIMITS.name),
    companyUrl: httpsUrlSchema.nullable().default(null),
    location: optionalText(TEXT_LIMITS.name),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    status: z.enum(CONTENT_STATUSES).default("draft"),
    startedOn: isoDateSchema,
    // Null while the position is current.
    endedOn: isoDateSchema.nullable().default(null),
    sortOrder: sortOrderSchema,
    skills: skillSlugsSchema,
    translations: translationsSchema(
      z.object({
        role: text(TEXT_LIMITS.title),
        ...summaryFields,
        technicalMd: markdownSchema,
      }),
    ),
  })
  .refine(
    (e) => endsAfterStart(e.startedOn, e.endedOn),
    datesOutOfOrder("endedOn"),
  );

const educationFields = {
  school: text(TEXT_LIMITS.name),
  location: optionalText(TEXT_LIMITS.name),
  startedOn: isoDateSchema,
  endedOn: isoDateSchema.nullable().default(null),
  sortOrder: sortOrderSchema,
  translations: translationsSchema(
    z.object({
      degree: text(TEXT_LIMITS.title),
      description: z.string().trim().max(TEXT_LIMITS.summary).default(""),
    }),
  ),
};

function educationDatesInOrder(e: {
  startedOn: string;
  endedOn: string | null;
}): boolean {
  return endsAfterStart(e.startedOn, e.endedOn);
}

/** What the admin edits: not routed, the slug is drawn from the entry once, at creation. */
export const educationContentSchema = z
  .object(educationFields)
  .refine(educationDatesInOrder, datesOutOfOrder("endedOn"));

export const educationInputSchema = z
  .object({ slug: slugSchema, ...educationFields })
  .refine(educationDatesInOrder, datesOutOfOrder("endedOn"));

const certificationFields = {
  name: text(TEXT_LIMITS.name),
  issuer: text(TEXT_LIMITS.name),
  issuedOn: isoDateSchema,
  expiresOn: isoDateSchema.nullable().default(null),
  credentialId: optionalText(TEXT_LIMITS.name),
  verifyUrl: httpsUrlSchema.nullable().default(null),
  sortOrder: sortOrderSchema,
  translations: translationsSchema(
    z.object({
      description: z.string().trim().max(TEXT_LIMITS.summary).default(""),
    }),
  ),
};

function certificationDatesInOrder(c: {
  issuedOn: string;
  expiresOn: string | null;
}): boolean {
  return endsAfterStart(c.issuedOn, c.expiresOn);
}

/** What the admin edits: as for education, the slug is drawn once, at creation. */
export const certificationContentSchema = z
  .object(certificationFields)
  .refine(certificationDatesInOrder, datesOutOfOrder("expiresOn"));

export const certificationInputSchema = z
  .object({ slug: slugSchema, ...certificationFields })
  .refine(certificationDatesInOrder, datesOutOfOrder("expiresOn"));

export const tileInputSchema = z.object({
  kind: z.enum(TILE_KINDS),
  size: z.enum(TILE_SIZES).default("md"),
  sortOrder: sortOrderSchema,
  visible: z.boolean().default(true),
});

export type ProfileInput = z.output<typeof profileInputSchema>;
export type SocialLinkInput = z.output<typeof socialLinkInputSchema>;
export type SkillInput = z.output<typeof skillInputSchema>;
export type ProjectInput = z.output<typeof projectInputSchema>;
export type ExperienceInput = z.output<typeof experienceInputSchema>;
export type EducationInput = z.output<typeof educationInputSchema>;
export type EducationContent = z.output<typeof educationContentSchema>;
export type CertificationInput = z.output<typeof certificationInputSchema>;
export type CertificationContent = z.output<typeof certificationContentSchema>;
export type TileInput = z.output<typeof tileInputSchema>;
