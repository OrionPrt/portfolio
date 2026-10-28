import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { insertProject, insertSkill } from "../../../test/fixtures/content";
import { createProjectRepository } from "./repository";

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

function repository() {
  return createProjectRepository(testDb.db);
}

describe("listPublished", () => {
  it("returns published projects only, featured first then by sort order", async () => {
    await insertProject(testDb.db, { slug: "second", sortOrder: 2 });
    await insertProject(testDb.db, { slug: "draft", status: "draft" });
    await insertProject(testDb.db, { slug: "first", sortOrder: 1 });
    await insertProject(testDb.db, {
      slug: "star",
      featured: true,
      sortOrder: 9,
    });

    const result = await repository().listPublished("fr");

    expect(result.ok && result.data.map((project) => project.slug)).toEqual([
      "star",
      "first",
      "second",
    ]);
  });

  it("is bounded and paginated", async () => {
    for (const index of [1, 2, 3]) {
      await insertProject(testDb.db, { slug: `p-${index}`, sortOrder: index });
    }

    const result = await repository().listPublished("fr", {
      limit: 1,
      offset: 1,
    });

    expect(result.ok && result.data.map((project) => project.slug)).toEqual([
      "p-2",
    ]);
  });

  it("localizes the content and lists the skills in their order", async () => {
    const react = await insertSkill(testDb.db, "react");
    const rust = await insertSkill(testDb.db, "rust", "low_level");
    await insertProject(
      testDb.db,
      { slug: "demo" },
      ["fr", "en"],
      [rust, react],
    );

    const result = await repository().listPublished("en");
    const project = result.ok ? result.data[0] : undefined;

    expect(project).toMatchObject({
      slug: "demo",
      title: "demo (en)",
      summary: { context: "demo context (en)" },
      isFallback: false,
    });
    expect(project?.skills.map((skill) => skill.slug)).toEqual([
      "rust",
      "react",
    ]);
  });

  it("falls back to French when the English translation is missing", async () => {
    await insertProject(testDb.db, { slug: "fr-only" }, ["fr"]);

    const result = await repository().listPublished("en");

    expect(result.ok && result.data[0]).toMatchObject({
      title: "fr-only (fr)",
      isFallback: true,
      contentLocale: "fr",
    });
  });

  it("skips a project that has no translation at all, without shortening a page", async () => {
    await insertProject(
      testDb.db,
      { slug: "untranslated", featured: true },
      [],
    );
    await insertProject(testDb.db, { slug: "translated" });

    const result = await repository().listPublished("fr", { limit: 1 });

    expect(result.ok && result.data.map((project) => project.slug)).toEqual([
      "translated",
    ]);
  });
});

describe("findPublishedBySlug", () => {
  it("finds a published project", async () => {
    await insertProject(testDb.db, { slug: "demo" });

    const result = await repository().findPublishedBySlug("demo", "fr");

    expect(result.ok && result.data?.title).toBe("demo (fr)");
  });

  it.each(["missing", "draft"])(
    "returns undefined for the %s project",
    async (slug) => {
      await insertProject(testDb.db, { slug: "draft", status: "draft" });

      const result = await repository().findPublishedBySlug(slug, "fr");

      expect(result).toEqual({ ok: true, data: undefined });
    },
  );
});

describe("covers", () => {
  it("shows a project's cover with its text in the page's language", async () => {
    const [image] = await testDb.query<{ id: string }>(
      `insert into media (sha256, pathname, width, height, variants)
       values ('${"a".repeat(64)}', 'media/one', 960, 540,
         '[{"width":480,"height":270,"url":"/m/480.webp","bytes":1},{"width":960,"height":540,"url":"/m/960.webp","bytes":2}]')
       returning id`,
    );
    const mediaId = image?.id ?? "";
    await testDb.exec(
      `insert into media_translations (media_id, locale, alt)
       values ('${mediaId}', 'fr', 'Tableau de bord'), ('${mediaId}', 'en', 'Dashboard')`,
    );
    await insertProject(testDb.db, { slug: "demo", coverMediaId: mediaId });
    await insertProject(testDb.db, { slug: "bare" });

    const projects = createProjectRepository(testDb.db);
    const found = await projects.findPublishedBySlug("demo", "en");
    const bare = await projects.findPublishedBySlug("bare", "en");

    expect(found.ok && found.data?.cover).toEqual({
      alt: "Dashboard",
      width: 960,
      height: 540,
      variants: [
        { width: 480, height: 270, url: "/m/480.webp", bytes: 1 },
        { width: 960, height: 540, url: "/m/960.webp", bytes: 2 },
      ],
    });
    expect(bare.ok && bare.data?.cover).toBeUndefined();
  });
});

describe("findFeatured", () => {
  it("returns the first featured published project", async () => {
    await insertProject(testDb.db, { slug: "plain" });
    await insertProject(testDb.db, {
      slug: "hidden-star",
      featured: true,
      status: "draft",
    });
    await insertProject(testDb.db, { slug: "star", featured: true });

    const result = await repository().findFeatured("fr");

    expect(result.ok && result.data?.slug).toBe("star");
  });

  it("returns undefined when nothing is featured", async () => {
    await insertProject(testDb.db, { slug: "plain" });

    expect(await repository().findFeatured("fr")).toEqual({
      ok: true,
      data: undefined,
    });
  });
});

describe("listPublishedSlugs", () => {
  it("lists every published slug, for the proxy's 404 check and the sitemap", async () => {
    await insertProject(testDb.db, { slug: "a" });
    await insertProject(testDb.db, { slug: "b", status: "draft" });
    // Its page would 404: no translation to show.
    await insertProject(testDb.db, { slug: "c" }, []);

    const result = await repository().listPublishedSlugs();

    expect(result).toEqual({ ok: true, data: ["a"] });
  });
});
