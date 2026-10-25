import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { insertExperience, insertSkill } from "../../../test/fixtures/content";
import { createExperienceRepository } from "./repository";

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
  return createExperienceRepository(testDb.db);
}

describe("listPublished", () => {
  it("lists the current position first, then the most recent ones", async () => {
    await insertExperience(testDb.db, {
      slug: "old",
      startedOn: "2020-01-01",
      endedOn: "2021-01-01",
    });
    await insertExperience(testDb.db, {
      slug: "recent",
      startedOn: "2022-01-01",
      endedOn: "2023-06-01",
    });
    await insertExperience(testDb.db, {
      slug: "current",
      startedOn: "2023-07-01",
    });
    await insertExperience(testDb.db, { slug: "hidden", status: "draft" });

    const result = await repository().listPublished("fr");

    expect(
      result.ok && result.data.map((experience) => experience.slug),
    ).toEqual(["current", "recent", "old"]);
  });

  it("localizes the role and summary and flags the current position", async () => {
    const docker = await insertSkill(testDb.db, "docker", "devops");
    await insertExperience(
      testDb.db,
      { slug: "current" },
      ["fr", "en"],
      [docker],
    );

    const result = await repository().listPublished("en");

    expect(result.ok && result.data[0]).toMatchObject({
      slug: "current",
      role: "current role (en)",
      summary: { result: "current result (en)" },
      isCurrent: true,
      isFallback: false,
      contentLocale: "en",
      skills: [{ slug: "docker", name: "DOCKER" }],
    });
  });

  it("leaves out an experience with no translation at all", async () => {
    await insertExperience(testDb.db, { slug: "untranslated" }, []);
    await insertExperience(testDb.db, { slug: "translated" });

    const result = await repository().listPublished("en");

    expect(
      result.ok && result.data.map((experience) => experience.slug),
    ).toEqual(["translated"]);
  });

  it("is bounded and paginated", async () => {
    for (const year of [2020, 2021, 2022]) {
      await insertExperience(testDb.db, {
        slug: `job-${year}`,
        startedOn: `${year}-01-01`,
        endedOn: `${year}-12-31`,
      });
    }

    const result = await repository().listPublished("fr", { limit: 2 });

    expect(
      result.ok && result.data.map((experience) => experience.slug),
    ).toEqual(["job-2022", "job-2021"]);
  });
});

describe("findCurrent", () => {
  it("returns the latest position still in progress", async () => {
    await insertExperience(testDb.db, {
      slug: "side",
      startedOn: "2022-01-01",
    });
    await insertExperience(testDb.db, {
      slug: "main",
      startedOn: "2024-01-01",
    });

    const result = await repository().findCurrent("fr");

    expect(result.ok && result.data?.slug).toBe("main");
  });

  it("returns undefined when every position has ended", async () => {
    await insertExperience(testDb.db, {
      slug: "done",
      startedOn: "2020-01-01",
      endedOn: "2021-01-01",
    });

    expect(await repository().findCurrent("fr")).toEqual({
      ok: true,
      data: undefined,
    });
  });
});

describe("findPublishedBySlug and listPublishedSlugs", () => {
  it("finds a published experience and ignores drafts", async () => {
    await insertExperience(testDb.db, { slug: "visible" });
    await insertExperience(testDb.db, { slug: "draft", status: "draft" });
    await insertExperience(testDb.db, { slug: "untranslated" }, []);

    const found = await repository().findPublishedBySlug("visible", "fr");
    const draft = await repository().findPublishedBySlug("draft", "fr");
    const slugs = await repository().listPublishedSlugs();

    expect(found.ok && found.data?.role).toBe("visible role (fr)");
    expect(draft).toEqual({ ok: true, data: undefined });
    expect(slugs).toEqual({ ok: true, data: ["visible"] });
  });
});
