import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PostInput } from "@/features/content/schemas";
import { ok } from "@/lib/result";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { insertSkill } from "../../../test/fixtures/content";
import { createPostsAdminRepository } from "./admin-repository";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
});

const TEXT = { title: "Titre", excerpt: "Résumé", bodyMd: "## Texte" };

function post(overrides: Partial<PostInput> = {}): PostInput {
  return {
    slug: "un-article",
    kind: "article",
    status: "draft",
    publishedOn: null,
    platform: null,
    difficulty: null,
    retiredOn: null,
    isDisclosureAllowed: false,
    coverMediaId: null,
    skills: [],
    translations: { fr: TEXT },
    ...overrides,
  };
}

async function created(input: PostInput): Promise<string> {
  const outcome = await createPostsAdminRepository(testDb.db).create(input);
  if (!outcome.ok || outcome.data.status !== "saved") {
    throw new Error("Not created");
  }
  return outcome.data.id;
}

describe("posts admin repository", () => {
  it("creates a post with its skills in order, and finds it as sent", async () => {
    await insertSkill(testDb.db, "rust", "low_level");
    await insertSkill(testDb.db, "linux", "devops");
    const input = post({ skills: ["linux", "rust"] });

    const id = await created(input);

    expect(await createPostsAdminRepository(testDb.db).find(id)).toEqual(
      ok({ id, ...input }),
    );
  });

  it("lists drafts first, each titled in French, else in its own language", async () => {
    await created(
      post({
        slug: "published",
        status: "published",
        publishedOn: "2026-10-01",
        translations: { en: { ...TEXT, title: "English only" } },
      }),
    );
    await created(post({ slug: "draft" }));

    const listed = await createPostsAdminRepository(testDb.db).list();

    expect(
      listed.ok &&
        listed.data.map(({ slug, title, locales }) => ({
          slug,
          title,
          locales,
        })),
    ).toEqual([
      { slug: "draft", title: "Titre", locales: ["fr"] },
      { slug: "published", title: "English only", locales: ["en"] },
    ]);
  });

  it("removes a language left out, and gives it to the audit log", async () => {
    const id = await created(
      post({ translations: { fr: TEXT, en: { ...TEXT, title: "Title" } } }),
    );

    const saved = await createPostsAdminRepository(testDb.db).update(
      id,
      post({ translations: { en: { ...TEXT, title: "Title" } } }),
    );

    expect(saved.ok && saved.data).toMatchObject({
      status: "saved",
      diff: {
        removedTranslations: [expect.objectContaining({ locale: "fr" })],
      },
    });
    expect(await testDb.query("select locale from post_translations")).toEqual([
      { locale: "en" },
    ]);
  });

  it("refuses a slug another post holds, and an unknown post", async () => {
    await created(post());
    const other = await created(post({ slug: "autre" }));
    const posts = createPostsAdminRepository(testDb.db);

    expect(await posts.create(post())).toEqual(
      ok({ status: "conflict", field: "slug" }),
    );
    expect(await posts.update(other, post())).toEqual(
      ok({ status: "conflict", field: "slug" }),
    );
    expect(
      await posts.update("0f8fad5b-d9cb-469f-a165-70867728950e", post()),
    ).toEqual(ok({ status: "not_found" }));
  });
});
