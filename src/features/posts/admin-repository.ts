import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  ne,
  notInArray,
  sql,
} from "drizzle-orm";

import { MAX_LINKED_SKILLS, MAX_SLUGS } from "@/db/limits";
import { alongside } from "@/db/one-statement";
import { runQuery } from "@/db/query";
import { posts, postSkills, postTranslations, skills } from "@/db/schema";
import type { Database } from "@/db/types";
import {
  proposedValues,
  redirectWrites,
  skillLinkWrites,
  translationEntries,
  type SkillLinkTable,
} from "@/features/admin/entry-writes";
import type { SaveOutcome } from "@/features/admin/save-content";
import type { PostInput } from "@/features/content/schemas";
import type { ContentStatus, PostKind } from "@/features/content/vocabulary";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locales";
import type { Result } from "@/lib/result";

const TRANSLATION_FIELDS = {
  title: postTranslations.title,
  excerpt: postTranslations.excerpt,
  bodyMd: postTranslations.bodyMd,
};

const SKILL_LINKS: SkillLinkTable = {
  table: postSkills,
  entryColumn: postSkills.postId,
  skillColumn: postSkills.skillId,
  placeColumn: postSkills.sortOrder,
};

const FIELDS = {
  id: posts.id,
  slug: posts.slug,
  kind: posts.kind,
  status: posts.status,
  publishedOn: posts.publishedOn,
  platform: posts.platform,
  difficulty: posts.difficulty,
  retiredOn: posts.retiredOn,
  isDisclosureAllowed: posts.isDisclosureAllowed,
  coverMediaId: posts.coverMediaId,
};

/** The post as the admin edits it: every language it has, its skills in order. */
export type PostForEdit = PostInput & { readonly id: string };

export interface PostListEntry {
  readonly id: string;
  readonly slug: string;
  readonly kind: PostKind;
  readonly status: ContentStatus;
  readonly publishedOn: string | null;
  /**
   * The day the site shows it: its publication day, or a write-up's
   * retirement day when later and the platform allows nothing before.
   */
  readonly showsOn: string | null;
  /** In the default language, else the other one; the slug when it has none. */
  readonly title: string;
  readonly locales: readonly Locale[];
}

const CONFLICT = { status: "conflict", field: "slug" } as const;
const NOT_FOUND = { status: "not_found" } as const;

/** Drafts first (no day yet), then from the latest day. */
const LIST_ORDER = [
  sql`${posts.publishedOn} desc nulls first`,
  desc(posts.createdAt),
  asc(posts.slug),
];

/** The post's own columns, without what it says or links. */
function columnsOf(input: PostInput) {
  const { slug, kind, status, publishedOn, platform, difficulty } = input;
  const { retiredOn, isDisclosureAllowed, coverMediaId } = input;
  return {
    slug,
    kind,
    status,
    publishedOn,
    platform,
    difficulty,
    retiredOn,
    isDisclosureAllowed,
    coverMediaId,
  };
}

function translationsWrite(
  db: Database,
  postId: string,
  translations: PostInput["translations"],
) {
  return db
    .insert(postTranslations)
    .values(
      translationEntries(translations).map(([locale, values]) => ({
        postId,
        locale,
        ...values,
      })),
    )
    .onConflictDoUpdate({
      target: [postTranslations.postId, postTranslations.locale],
      set: proposedValues(TRANSLATION_FIELDS),
    });
}

/** Each post's title in the default language, else another, and its languages. */
async function titlesOf(
  db: Database,
  ids: readonly string[],
): Promise<ReadonlyMap<string, { title: string; locales: Locale[] }>> {
  if (ids.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      postId: postTranslations.postId,
      locale: postTranslations.locale,
      title: postTranslations.title,
    })
    .from(postTranslations)
    .where(inArray(postTranslations.postId, [...ids]))
    .limit(ids.length * LOCALES.length);
  return new Map(
    ids.map((id) => {
      const own = rows.filter((row) => row.postId === id);
      const named =
        own.find((row) => row.locale === DEFAULT_LOCALE) ?? own.at(0);
      return [
        id,
        {
          title: named?.title ?? "",
          locales: LOCALES.filter((locale) =>
            own.some((row) => row.locale === locale),
          ),
        },
      ];
    }),
  );
}

/**
 * The posts as the admin edits them. A save is one statement: the row, its
 * languages, its skills and the redirects it leaves happen together, or not
 * at all.
 */
export function createPostsAdminRepository(db: Database) {
  const isSlugTaken = async (slug: string, exceptId?: string) => {
    const [taken] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(
        exceptId === undefined
          ? eq(posts.slug, slug)
          : and(eq(posts.slug, slug), ne(posts.id, exceptId)),
      );
    return taken !== undefined;
  };

  /** The writes of a save besides the post's row: what it says and links. */
  const contentWrites = (id: string, input: PostInput) => [
    translationsWrite(db, id, input.translations),
    ...skillLinkWrites(SKILL_LINKS, id, input.skills),
  ];

  return {
    list: (): Promise<Result<readonly PostListEntry[]>> =>
      runQuery("posts.admin_read_failed", async () => {
        const rows = await db
          .select({
            id: posts.id,
            slug: posts.slug,
            kind: posts.kind,
            status: posts.status,
            publishedOn: posts.publishedOn,
            showsOn: sql<string | null>`case
              when ${posts.kind} = 'writeup' and not ${posts.isDisclosureAllowed}
                and ${posts.retiredOn} > ${posts.publishedOn}
              then ${posts.retiredOn}::text
              else ${posts.publishedOn}::text end`,
          })
          .from(posts)
          .orderBy(...LIST_ORDER)
          .limit(MAX_SLUGS);
        const titles = await titlesOf(
          db,
          rows.map((row) => row.id),
        );
        return rows.map((row) => {
          const named = titles.get(row.id);
          return {
            ...row,
            title:
              named === undefined || named.title === ""
                ? row.slug
                : named.title,
            locales: named?.locales ?? [],
          };
        });
      }),

    find: (id: string): Promise<Result<PostForEdit | undefined>> =>
      runQuery("posts.admin_read_failed", async () => {
        const [row] = await db
          .select(FIELDS)
          .from(posts)
          .where(eq(posts.id, id));
        if (row === undefined) {
          return undefined;
        }
        const [translations, linked] = await Promise.all([
          db
            .select({ locale: postTranslations.locale, ...TRANSLATION_FIELDS })
            .from(postTranslations)
            .where(eq(postTranslations.postId, id))
            .limit(LOCALES.length),
          db
            .select({ slug: skills.slug })
            .from(postSkills)
            .innerJoin(skills, eq(skills.id, postSkills.skillId))
            .where(eq(postSkills.postId, id))
            .orderBy(asc(postSkills.sortOrder), asc(skills.slug))
            .limit(MAX_LINKED_SKILLS),
        ]);
        return {
          ...row,
          skills: linked.map((skill) => skill.slug),
          translations: Object.fromEntries(
            translations.map(({ locale, ...values }) => [locale, values]),
          ),
        };
      }),

    create: (input: PostInput): Promise<Result<SaveOutcome>> =>
      runQuery("posts.admin_save_failed", async () => {
        const [counted] = await db.select({ total: count() }).from(posts);
        // The slug listings stop there: one more would answer 404.
        if ((counted?.total ?? 0) >= MAX_SLUGS) {
          return { status: "full" } as const;
        }
        if (await isSlugTaken(input.slug)) {
          return CONFLICT;
        }
        const id = crypto.randomUUID();
        await db
          .with(
            ...alongside(db, [
              ...redirectWrites(db, "posts", undefined, input),
              ...contentWrites(id, input),
            ]),
          )
          .insert(posts)
          .values({ id, ...columnsOf(input) });
        return {
          status: "saved",
          id,
          isNew: true,
          slugs: [input.slug],
        } as const;
      }),

    /**
     * The languages and skills become the ones sent; a language left out is
     * removed, and returned for the audit log.
     */
    update: (id: string, input: PostInput): Promise<Result<SaveOutcome>> =>
      runQuery("posts.admin_save_failed", async () => {
        // Gone first: a deleted post is not "a taken slug".
        const [before] = await db
          .select({ slug: posts.slug, status: posts.status })
          .from(posts)
          .where(eq(posts.id, id));
        if (before === undefined) {
          return NOT_FOUND;
        }
        if (await isSlugTaken(input.slug, id)) {
          return CONFLICT;
        }
        const row = db
          .update(posts)
          .set(columnsOf(input))
          .where(eq(posts.id, id));
        const kept = translationEntries(input.translations).map(
          ([locale]) => locale,
        );
        const removed = await db
          .with(
            ...alongside(db, [
              ...redirectWrites(db, "posts", before, input),
              row,
              ...contentWrites(id, input),
            ]),
          )
          .delete(postTranslations)
          .where(
            and(
              eq(postTranslations.postId, id),
              notInArray(postTranslations.locale, kept),
            ),
          )
          .returning({
            locale: postTranslations.locale,
            ...TRANSLATION_FIELDS,
          });
        return {
          status: "saved",
          id,
          isNew: false,
          slugs:
            before.slug === input.slug
              ? [input.slug]
              : [input.slug, before.slug],
          ...(removed.length === 0
            ? {}
            : { diff: { removedTranslations: removed } }),
        } as const;
      }),
  };
}
