import { and, count, desc, eq, sql } from "drizzle-orm";

import { MAX_MEDIA } from "@/db/limits";
import { alongside } from "@/db/one-statement";
import { runQuery } from "@/db/query";
import {
  certifications,
  education,
  experiences,
  media,
  mediaTranslations,
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
  readonly kind: "project" | "experience" | "education" | "certification";
  readonly id: string;
  readonly label: string;
}

export interface MediaListEntry extends MediaOption {
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

/** How many entries show the image: a cover, a logo or a badge each. */
const USAGE_COUNT = sql<number>`(
  (select count(*) from ${projects} where ${projects.coverMediaId} = ${media.id})
  + (select count(*) from ${experiences} where ${experiences.logoMediaId} = ${media.id})
  + (select count(*) from ${education} where ${education.logoMediaId} = ${media.id})
  + (select count(*) from ${certifications} where ${certifications.badgeMediaId} = ${media.id})
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

/** The entries that show the image, each named as its list names it. */
function usagesOf(db: Database, id: string): Promise<readonly MediaUsage[]> {
  const named = (
    kind: MediaUsage["kind"],
    rows: readonly { id: string; label: string | null }[],
  ) => rows.map((row) => ({ kind, id: row.id, label: row.label ?? "" }));
  return Promise.all([
    db
      .select({ id: projects.id, label: projectTranslations.title })
      .from(projects)
      .leftJoin(
        projectTranslations,
        and(
          eq(projectTranslations.projectId, projects.id),
          eq(projectTranslations.locale, DEFAULT_LOCALE),
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
  ]).then(([project, experience, school, certification]) => [
    ...named("project", project),
    ...named("experience", experience),
    ...named("education", school),
    ...named("certification", certification),
  ]);
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
        const rows = await db
          .select({
            id: media.id,
            variants: media.variants,
            alt: mediaTranslations.alt,
          })
          .from(media)
          .leftJoin(mediaTranslations, withAlt(DEFAULT_LOCALE))
          .orderBy(desc(media.createdAt), desc(media.id))
          .limit(MAX_MEDIA);
        return rows.map(({ id, variants, alt }) => ({
          id,
          alt: alt ?? "",
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
