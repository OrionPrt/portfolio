import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { posts, postSkills, postTranslations } from "@/db/schema";
import { ok } from "@/lib/result";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { insertSkill } from "../../../test/fixtures/content";
import { createPostRepository } from "./repository";

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

type Locale = "fr" | "en";

async function insertPost(
  values: Partial<typeof posts.$inferInsert> & { slug: string },
  locales: readonly Locale[] = ["fr"],
): Promise<string> {
  const [row] = await testDb.db
    .insert(posts)
    .values({ status: "published", publishedOn: "2026-01-01", ...values })
    .returning({ id: posts.id });
  const postId = row?.id ?? "";
  if (locales.length > 0) {
    await testDb.db.insert(postTranslations).values(
      locales.map((locale) => ({
        postId,
        locale,
        title: `${values.slug} (${locale})`,
        excerpt: `excerpt (${locale})`,
        bodyMd: `## Body (${locale})`,
      })),
    );
  }
  return postId;
}

function repository() {
  return createPostRepository(testDb.db);
}

describe("post repository", () => {
  it("lists published posts whose day has come, the latest first", async () => {
    await insertPost({ slug: "older", publishedOn: "2026-01-01" });
    await insertPost({ slug: "newer", publishedOn: "2026-03-01" });
    await insertPost({ slug: "draft", status: "draft", publishedOn: null });
    await insertPost({ slug: "tomorrow", publishedOn: "2999-01-01" });
    await insertPost({ slug: "speechless" }, []);

    const listed = await repository().listPublished("fr");

    expect(listed.ok && listed.data.map((post) => post.slug)).toEqual([
      "newer",
      "older",
    ]);
    expect(await repository().listPublishedSlugs()).toEqual(
      ok(["newer", "older"]),
    );
  });

  it("keeps a write-up out until its challenge retires, unless the platform allows it", async () => {
    const writeup = {
      kind: "writeup" as const,
      platform: "hackthebox" as const,
    };
    await insertPost({ ...writeup, slug: "live", retiredOn: "2999-01-01" });
    await insertPost({ ...writeup, slug: "retired", retiredOn: "2026-01-01" });
    await insertPost({
      ...writeup,
      slug: "allowed",
      retiredOn: null,
      isDisclosureAllowed: true,
    });

    expect(await repository().listPublishedSlugs()).toEqual(
      ok(["allowed", "retired"]),
    );
  });

  it("shows a post in the language asked, else in the one it is written in", async () => {
    await insertPost({ slug: "english-only" }, ["en"]);
    await insertPost({ slug: "both" }, ["fr", "en"]);

    const listed = await repository().listPublished("fr");
    const [both, english] = listed.ok ? listed.data : [];

    expect(english).toMatchObject({
      slug: "english-only",
      title: "english-only (en)",
      isFallback: true,
      contentLocale: "en",
      locales: ["en"],
    });
    expect(both).toMatchObject({
      title: "both (fr)",
      isFallback: false,
      locales: ["fr", "en"],
    });
  });

  it("finds a published post with its body and skills, and nothing else", async () => {
    const rust = await insertSkill(testDb.db, "rust", "low_level");
    const id = await insertPost({
      slug: "a-box",
      kind: "writeup",
      platform: "hackthebox",
      difficulty: "hard",
      retiredOn: "2025-12-01",
    });
    await testDb.db
      .insert(postSkills)
      .values({ postId: id, skillId: rust, sortOrder: 0 });
    await insertPost({ slug: "hidden", status: "draft", publishedOn: null });

    expect(await repository().findPublishedBySlug("a-box", "en")).toEqual(
      ok(
        expect.objectContaining({
          kind: "writeup",
          platform: "hackthebox",
          difficulty: "hard",
          retiredOn: "2025-12-01",
          bodyMd: "## Body (fr)",
          skills: [{ slug: "rust", name: "RUST" }],
        }),
      ),
    );
    expect(await repository().findPublishedBySlug("hidden", "fr")).toEqual(
      ok(undefined),
    );
  });

  it("finds the latest post, without its body", async () => {
    await insertPost({ slug: "older", publishedOn: "2026-01-01" });
    await insertPost({ slug: "newer", publishedOn: "2026-03-01" });

    const latest = await repository().findLatest("fr");

    expect(latest.ok && latest.data?.slug).toBe("newer");
    expect(
      latest.ok && latest.data !== undefined && "bodyMd" in latest.data,
    ).toBe(false);
  });
});
