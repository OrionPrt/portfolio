import { and, asc, desc, eq, lte, sql } from "drizzle-orm";

import { MAX_LINKED_SKILLS, MAX_SLUGS } from "@/db/limits";
import {
  pickTranslation,
  runQuery,
  toPage,
  type PageRequest,
} from "@/db/query";
import { posts, postSkills, postTranslations, type skills } from "@/db/schema";
import type { Database } from "@/db/types";
import { toSkillRefs } from "@/features/content/mappers";
import {
  toMediaView,
  WITH_MEDIA,
  type MediaRow,
} from "@/features/media/mappers";
import { LOCALES, type Locale } from "@/i18n/locales";
import type { Result } from "@/lib/result";

import type { PostSummary, PostView } from "./types";

type PostRow = typeof posts.$inferSelect & {
  readonly translations: readonly (typeof postTranslations.$inferSelect)[];
  readonly skills: readonly { readonly skill: typeof skills.$inferSelect }[];
  readonly cover: MediaRow | null;
};

const WITH_CONTENT = {
  translations: { limit: LOCALES.length },
  skills: {
    orderBy: [asc(postSkills.sortOrder), asc(postSkills.skillId)],
    limit: MAX_LINKED_SKILLS,
    with: { skill: true as const },
  },
  cover: WITH_MEDIA,
};

/** Today in Paris, the site's day, as the database tells it. */
const TODAY = sql`(now() at time zone 'Europe/Paris')::date`;

/**
 * Published, its day come (in Paris, as the admin dates it), and written in
 * some language: lists, slug listings and lookups agree, so the sitemap never
 * lists a 404. A later day keeps a post out until then; a write-up also waits
 * for its challenge's retirement, unless the platform allows it (ADR-0008).
 */
const PUBLISHED = and(
  eq(posts.status, "published"),
  lte(posts.publishedOn, TODAY),
  sql`(${posts.kind} <> 'writeup' or ${posts.isDisclosureAllowed} or ${posts.retiredOn} <= ${TODAY})`,
  // Drizzle's relational queries re-alias every column of a `where` to the root
  // table, so the subquery names its own columns by identifier.
  sql`exists (select 1 from ${postTranslations} as "t" where "t".${sql.identifier(postTranslations.postId.name)} = ${posts.id})`,
);

/** The latest first; a tie broken by slug, so the order never shifts. */
const DISPLAY_ORDER = [desc(posts.publishedOn), asc(posts.slug)];

function toPostView(row: PostRow, locale: Locale): PostView | undefined {
  const translation = pickTranslation(row.translations, locale);
  // PUBLISHED guarantees both; a row read otherwise is not shown.
  if (translation === undefined || row.publishedOn === null) {
    return undefined;
  }
  const { value } = translation;
  return {
    slug: row.slug,
    kind: row.kind,
    platform: row.platform,
    difficulty: row.difficulty,
    publishedOn: row.publishedOn,
    retiredOn: row.retiredOn,
    title: value.title,
    excerpt: value.excerpt,
    bodyMd: value.bodyMd,
    skills: toSkillRefs(row.skills),
    cover: toMediaView(row.cover, locale),
    locales: LOCALES.filter((candidate) =>
      row.translations.some((t) => t.locale === candidate),
    ),
    isFallback: translation.isFallback,
    contentLocale: value.locale,
  };
}

/** A list entry: the post without its body. */
function toSummary(view: PostView): PostSummary {
  return {
    slug: view.slug,
    kind: view.kind,
    platform: view.platform,
    difficulty: view.difficulty,
    publishedOn: view.publishedOn,
    title: view.title,
    excerpt: view.excerpt,
    skills: view.skills,
    cover: view.cover,
    locales: view.locales,
    isFallback: view.isFallback,
    contentLocale: view.contentLocale,
  };
}

export interface PostRepository {
  listPublished(
    locale: Locale,
    request?: PageRequest,
  ): Promise<Result<readonly PostSummary[]>>;
  findPublishedBySlug(
    slug: string,
    locale: Locale,
  ): Promise<Result<PostView | undefined>>;
  findLatest(locale: Locale): Promise<Result<PostSummary | undefined>>;
  listPublishedSlugs(): Promise<Result<readonly string[]>>;
}

export function createPostRepository(db: Database): PostRepository {
  return {
    listPublished: (locale, request) => {
      const page = toPage(request);
      return runQuery("posts.list_failed", async () => {
        const rows = await db.query.posts.findMany({
          where: PUBLISHED,
          orderBy: DISPLAY_ORDER,
          limit: page.limit,
          offset: page.offset,
          with: WITH_CONTENT,
        });
        return rows.flatMap((row) => {
          const view = toPostView(row, locale);
          return view === undefined ? [] : [toSummary(view)];
        });
      });
    },

    findPublishedBySlug: (slug, locale) =>
      runQuery("posts.find_failed", async () => {
        const row = await db.query.posts.findFirst({
          where: and(PUBLISHED, eq(posts.slug, slug)),
          with: WITH_CONTENT,
        });
        return row === undefined ? undefined : toPostView(row, locale);
      }),

    findLatest: (locale) =>
      runQuery("posts.latest_failed", async () => {
        const row = await db.query.posts.findFirst({
          where: PUBLISHED,
          orderBy: DISPLAY_ORDER,
          with: WITH_CONTENT,
        });
        const view = row === undefined ? undefined : toPostView(row, locale);
        return view === undefined ? undefined : toSummary(view);
      }),

    listPublishedSlugs: () =>
      runQuery("posts.slugs_failed", async () => {
        const rows = await db
          .select({ slug: posts.slug })
          .from(posts)
          .where(PUBLISHED)
          .orderBy(asc(posts.slug))
          .limit(MAX_SLUGS);
        return rows.map((row) => row.slug);
      }),
  };
}
