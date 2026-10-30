import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { alias, type PgColumn } from "drizzle-orm/pg-core";

import { MAX_MEDIA } from "@/db/limits";
import { alongside } from "@/db/one-statement";
import { runQuery } from "@/db/query";
import {
  certifications,
  education,
  experiences,
  experienceTranslations,
  media,
  mediaTranslations,
  posts,
  postTranslations,
  profileTranslations,
  projects,
  projectTranslations,
  type MediaVariant,
} from "@/db/schema";
import type { Database } from "@/db/types";
import { proposedValues } from "@/features/admin/entry-writes";
import type { SaveOutcome } from "@/features/admin/save-content";
import type { MediaAlt } from "@/features/content/schemas";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locales";
import type { Result } from "@/lib/result";

import { mediaReference } from "./references";
import type { MediaOption } from "./types";

export type { MediaOption };

/** An image processed and stored, as the library records it. */
export interface NewMedia {
  readonly id: string;
  readonly sha256: string;
  readonly pathname: string;
  readonly width: number;
  readonly height: number;
  readonly variants: readonly MediaVariant[];
  readonly alt: MediaAlt;
}

/** What shows an image: deleting it waits until none does. */
export interface MediaUsage {
  readonly kind:
    | "project"
    | "experience"
    | "education"
    | "certification"
    | "profile"
    | "post";
  readonly id: string;
  readonly label: string;
  /** Named in its Markdown (`media:<id>`), rather than its cover, logo or badge. */
  readonly inText: boolean;
}

export interface MediaListEntry extends Omit<MediaOption, "alts"> {
  readonly width: number;
  readonly height: number;
  readonly usageCount: number;
}

export interface MediaForEdit {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly variants: readonly MediaVariant[];
  readonly alt: MediaAlt;
  readonly usages: readonly MediaUsage[];
}

const NOT_FOUND = { status: "not_found" } as const;

/** Whether a text names the image (`media:<id>`); ids are fixed-length hex. */
const CITES = (text: SQL | PgColumn, reference: SQL) =>
  sql`strpos(${text}, ${reference}) > 0`;

/** The reference to the image of the row being counted. */
const ROW_REFERENCE = sql`('media:' || ${media.id}::text)`;

/**
 * How many entries show the image: as a cover, a logo or a badge, and in
 * their Markdown (each entry once, whatever its languages).
 */
const USAGE_COUNT = sql<number>`(
  (select count(*) from ${projects} where ${projects.coverMediaId} = ${media.id})
  + (select count(*) from ${experiences} where ${experiences.logoMediaId} = ${media.id})
  + (select count(*) from ${education} where ${education.logoMediaId} = ${media.id})
  + (select count(*) from ${certifications} where ${certifications.badgeMediaId} = ${media.id})
  + (select count(*) from ${posts} where ${posts.coverMediaId} = ${media.id})
  + (select count(distinct ${projectTranslations.projectId}) from ${projectTranslations}
     where ${CITES(projectTranslations.technicalMd, ROW_REFERENCE)})
  + (select count(distinct ${experienceTranslations.experienceId}) from ${experienceTranslations}
     where ${CITES(experienceTranslations.technicalMd, ROW_REFERENCE)})
  + (select count(distinct ${profileTranslations.profileId}) from ${profileTranslations}
     where ${CITES(profileTranslations.aboutMd, ROW_REFERENCE)})
  + (select count(distinct ${postTranslations.postId}) from ${postTranslations}
     where ${CITES(postTranslations.bodyMd, ROW_REFERENCE)})
)::int`;

/** The narrowest variant: a list's or a picker's thumbnail. */
function thumbnailOf(variants: readonly MediaVariant[]): MediaVariant {
  const [narrowest] = variants;
  if (narrowest === undefined) {
    // The database refuses an image without one (media_variants_count).
    throw new Error("An image without variants");
  }
  return narrowest;
}

function altsWrite(db: Database, mediaId: string, alt: MediaAlt) {
  return db
    .insert(mediaTranslations)
    .values(LOCALES.map((locale) => ({ mediaId, locale, alt: alt[locale] })))
    .onConflictDoUpdate({
      target: [mediaTranslations.mediaId, mediaTranslations.locale],
      set: proposedValues({ alt: mediaTranslations.alt }),
    });
}

type Kind = MediaUsage["kind"];
type Row = { readonly id: string; readonly label: string | null };

function usagesFrom(kind: Kind, inText: boolean, rows: readonly Row[]) {
  return rows.map((row) => ({
    kind,
    id: row.id,
    label: row.label ?? "",
    inText,
  }));
}

/** A project's title in the default language, for its usage's label. */
function projectTitles() {
  return alias(projectTranslations, "named");
}

/** A post's title in the default language, else its slug: it may have no French. */
function postLabel() {
  const named = alias(postTranslations, "post_named");
  return {
    named,
    label: sql<string>`coalesce(${named.title}, ${posts.slug})`,
    join: and(eq(named.postId, posts.id), eq(named.locale, DEFAULT_LOCALE)),
  };
}

/** The entries showing the image as their cover, logo or badge. */
async function imageUsages(db: Database, id: string) {
  const named = projectTitles();
  const post = postLabel();
  const [project, experience, school, certification, cover] = await Promise.all(
    [
      db
        .select({ id: projects.id, label: named.title })
        .from(projects)
        .leftJoin(
          named,
          and(
            eq(named.projectId, projects.id),
            eq(named.locale, DEFAULT_LOCALE),
          ),
        )
        .where(eq(projects.coverMediaId, id)),
      db
        .select({ id: experiences.id, label: experiences.company })
        .from(experiences)
        .where(eq(experiences.logoMediaId, id)),
      db
        .select({ id: education.id, label: education.school })
        .from(education)
        .where(eq(education.logoMediaId, id)),
      db
        .select({ id: certifications.id, label: certifications.name })
        .from(certifications)
        .where(eq(certifications.badgeMediaId, id)),
      db
        .select({ id: posts.id, label: post.label })
        .from(posts)
        .leftJoin(post.named, post.join)
        .where(eq(posts.coverMediaId, id)),
    ],
  );
  return [
    ...usagesFrom("project", false, project),
    ...usagesFrom("experience", false, experience),
    ...usagesFrom("education", false, school),
    ...usagesFrom("certification", false, certification),
    ...usagesFrom("post", false, cover),
  ];
}

/** The entries whose Markdown names the image, in any of its languages. */
async function textUsages(db: Database, id: string) {
  const reference = sql`${mediaReference(id)}`;
  const named = projectTitles();
  const post = postLabel();
  const [project, experience, about, body] = await Promise.all([
    db
      .select({ id: projects.id, label: named.title })
      .from(projects)
      .leftJoin(
        named,
        and(eq(named.projectId, projects.id), eq(named.locale, DEFAULT_LOCALE)),
      )
      .where(
        sql`exists (select 1 from ${projectTranslations}
          where ${projectTranslations.projectId} = ${projects.id}
          and ${CITES(projectTranslations.technicalMd, reference)})`,
      ),
    db
      .select({ id: experiences.id, label: experiences.company })
      .from(experiences)
      .where(
        sql`exists (select 1 from ${experienceTranslations}
          where ${experienceTranslations.experienceId} = ${experiences.id}
          and ${CITES(experienceTranslations.technicalMd, reference)})`,
      ),
    db
      .selectDistinct({
        id: sql<string>`${profileTranslations.profileId}::text`,
        label: sql<string>`''`,
      })
      .from(profileTranslations)
      .where(CITES(profileTranslations.aboutMd, reference)),
    db
      .select({ id: posts.id, label: post.label })
      .from(posts)
      .leftJoin(post.named, post.join)
      .where(
        sql`exists (select 1 from ${postTranslations}
          where ${postTranslations.postId} = ${posts.id}
          and ${CITES(postTranslations.bodyMd, reference)})`,
      ),
  ]);
  return [
    ...usagesFrom("project", true, project),
    ...usagesFrom("experience", true, experience),
    ...usagesFrom("profile", true, about),
    ...usagesFrom("post", true, body),
  ];
}

/** The entries that show the image, each named as its list names it. */
async function usagesOf(
  db: Database,
  id: string,
): Promise<readonly MediaUsage[]> {
  const [images, texts] = await Promise.all([
    imageUsages(db, id),
    textUsages(db, id),
  ]);
  return [...images, ...texts];
}

/** The image library as the admin manages it (ADR-0007). */
export function createMediaAdminRepository(db: Database) {
  const withAlt = (locale: Locale) =>
    and(
      eq(mediaTranslations.mediaId, media.id),
      eq(mediaTranslations.locale, locale),
    );

  return {
    count: (): Promise<Result<number>> =>
      runQuery("media.admin_read_failed", async () => {
        const [counted] = await db.select({ total: count() }).from(media);
        return counted?.total ?? 0;
      }),

    /** The image already stored from this very file, if any. */
    idOfFile: (sha256: string): Promise<Result<string | undefined>> =>
      runQuery("media.admin_read_failed", async () => {
        const [row] = await db
          .select({ id: media.id })
          .from(media)
          .where(eq(media.sha256, sha256));
        return row?.id;
      }),

    /** The image and its texts, in one statement. */
    create: (image: NewMedia): Promise<Result<void>> =>
      runQuery("media.admin_save_failed", async () => {
        const { alt, ...row } = image;
        await db
          .with(...alongside(db, [altsWrite(db, image.id, alt)]))
          .insert(media)
          .values(row);
      }),

    list: (): Promise<Result<readonly MediaListEntry[]>> =>
      runQuery("media.admin_read_failed", async () => {
        const rows = await db
          .select({
            id: media.id,
            width: media.width,
            height: media.height,
            variants: media.variants,
            alt: mediaTranslations.alt,
            usageCount: USAGE_COUNT,
          })
          .from(media)
          .leftJoin(mediaTranslations, withAlt(DEFAULT_LOCALE))
          .orderBy(desc(media.createdAt), desc(media.id))
          .limit(MAX_MEDIA);
        return rows.map(({ variants, alt, ...row }) => ({
          ...row,
          alt: alt ?? "",
          thumbnail: thumbnailOf(variants),
        }));
      }),

    /** The images a form's picker offers, latest first. */
    options: (): Promise<Result<readonly MediaOption[]>> =>
      runQuery("media.admin_read_failed", async () => {
        const french = alias(mediaTranslations, "french");
        const english = alias(mediaTranslations, "english");
        const rows = await db
          .select({
            id: media.id,
            variants: media.variants,
            fr: french.alt,
            en: english.alt,
          })
          .from(media)
          .leftJoin(
            french,
            and(eq(french.mediaId, media.id), eq(french.locale, "fr")),
          )
          .leftJoin(
            english,
            and(eq(english.mediaId, media.id), eq(english.locale, "en")),
          )
          .orderBy(desc(media.createdAt), desc(media.id))
          .limit(MAX_MEDIA);
        return rows.map(({ id, variants, fr, en }) => ({
          id,
          alt: fr ?? "",
          alts: { fr: fr ?? "", en: en ?? "" },
          thumbnail: thumbnailOf(variants),
        }));
      }),

    find: (id: string): Promise<Result<MediaForEdit | undefined>> =>
      runQuery("media.admin_read_failed", async () => {
        const [row] = await db
          .select({
            id: media.id,
            width: media.width,
            height: media.height,
            variants: media.variants,
          })
          .from(media)
          .where(eq(media.id, id));
        if (row === undefined) {
          return undefined;
        }
        const [alts, usages] = await Promise.all([
          db
            .select({
              locale: mediaTranslations.locale,
              alt: mediaTranslations.alt,
            })
            .from(mediaTranslations)
            .where(eq(mediaTranslations.mediaId, id))
            .limit(LOCALES.length),
          usagesOf(db, id),
        ]);
        const altIn = (locale: string) =>
          alts.find((text) => text.locale === locale)?.alt ?? "";
        return {
          ...row,
          alt: { fr: altIn("fr"), en: altIn("en") },
          usages,
        };
      }),

    updateAlt: (id: string, alt: MediaAlt): Promise<Result<SaveOutcome>> =>
      runQuery("media.admin_save_failed", async () => {
        const [existing] = await db
          .select({ id: media.id })
          .from(media)
          .where(eq(media.id, id));
        if (existing === undefined) {
          return NOT_FOUND;
        }
        await altsWrite(db, id, alt);
        return { status: "saved", id, isNew: false } as const;
      }),

    /** Who shows the image: nothing, before it can go. */
    usages: (id: string): Promise<Result<readonly MediaUsage[]>> =>
      runQuery("media.admin_read_failed", () => usagesOf(db, id)),
  };
}
