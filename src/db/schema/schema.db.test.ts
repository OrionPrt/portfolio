import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import {
  education,
  profile,
  projects,
  projectSkills,
  projectTranslations,
  skills,
  socialLinks,
} from "./index";

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

function newProject(overrides: Partial<typeof projects.$inferInsert> = {}) {
  return testDb.db
    .insert(projects)
    .values({ slug: "demo", domain: "web", ...overrides })
    .returning();
}

describe("migrations", () => {
  it("create every table on an empty database", async () => {
    const tables = await testDb.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );

    expect(tables.map((row) => row.table_name)).toEqual([
      "bento_tiles",
      "certification_translations",
      "certifications",
      "contact_messages",
      "education",
      "education_translations",
      "experience_skills",
      "experience_translations",
      "experiences",
      "profile",
      "profile_translations",
      "project_skills",
      "project_translations",
      "projects",
      "skills",
      "social_links",
    ]);
  });
});

/** Fails unless the write is refused by this very constraint, not by any other error. */
async function expectRefusedBy(
  write: Promise<unknown>,
  constraint: string,
): Promise<void> {
  await expect(write).rejects.toMatchObject({ cause: { constraint } });
}

describe("constraints", () => {
  it.each(["Demo", "demo project", "-demo", "demo-", "démo", "a".repeat(81)])(
    "rejects the malformed slug %j",
    async (slug) => {
      await expectRefusedBy(newProject({ slug }), "projects_slug_format");
    },
  );

  it("gives education a unique slug, so the seed can upsert it", async () => {
    const row = { slug: "epitech", school: "Epitech", startedOn: "2020-09-01" };
    await testDb.db.insert(education).values(row);

    await expectRefusedBy(
      testDb.db.insert(education).values(row),
      "education_slug_unique",
    );
    await expectRefusedBy(
      testDb.db.insert(education).values({ ...row, slug: "Epitech" }),
      "education_slug_format",
    );
  });

  it.each([
    "javascript:alert(1)",
    "http://example.com",
    "//example.com",
    "https://",
    "https://a b",
    "https://a.example\njavascript:alert(1)",
  ])("rejects the non-https or malformed project link %j", async (repoUrl) => {
    await expectRefusedBy(newProject({ repoUrl }), "projects_repo_url_https");
  });

  it("rejects a project that ends before it starts", async () => {
    await expectRefusedBy(
      newProject({ startedOn: "2025-06-01", endedOn: "2025-01-01" }),
      "projects_dates_ordered",
    );
  });

  it("rejects a project with an end date but no start date", async () => {
    await expectRefusedBy(
      newProject({ endedOn: "2025-01-01" }),
      "projects_dates_ordered",
    );
  });

  it("only allows one profile row", async () => {
    await testDb.db.insert(profile).values({ displayName: "Orion" });

    await expectRefusedBy(
      testDb.db.insert(profile).values({ id: 2, displayName: "Other" }),
      "profile_singleton",
    );
  });

  it.each([
    ["github", "javascript:alert(1)"],
    ["github", "http://github.com/x"],
    ["github", "mailto:hello@example.com"],
    ["email", "https://example.com"],
    ["email", "mailto:"],
    ["email", "mailto:a b@example.com"],
  ] as const)("rejects the %s link %j", async (kind, url) => {
    await expectRefusedBy(
      testDb.db.insert(socialLinks).values({ kind, url }),
      "social_links_url_scheme",
    );
  });

  it("accepts https and mailto social links", async () => {
    await testDb.db.insert(socialLinks).values([
      { kind: "github", url: "https://github.com/OrionPrt" },
      { kind: "email", url: "mailto:hello@example.com" },
    ]);

    expect(await testDb.db.select().from(socialLinks)).toHaveLength(2);
  });

  it("keeps one translation per project and locale", async () => {
    const [project] = await newProject();
    const translation = {
      projectId: project?.id ?? "",
      locale: "fr" as const,
      title: "Démo",
      tagline: "t",
      summaryContext: "c",
      summaryAction: "a",
      summaryResult: "r",
    };
    await testDb.db.insert(projectTranslations).values(translation);

    await expectRefusedBy(
      testDb.db.insert(projectTranslations).values(translation),
      "project_translations_project_id_locale_pk",
    );
  });

  it("deletes translations and skill links with their project", async () => {
    const [project] = await newProject();
    const [skill] = await testDb.db
      .insert(skills)
      .values({ slug: "typescript", name: "TypeScript", domain: "web" })
      .returning();
    const projectId = project?.id ?? "";
    await testDb.db.insert(projectTranslations).values({
      projectId,
      locale: "fr",
      title: "Démo",
      tagline: "t",
      summaryContext: "c",
      summaryAction: "a",
      summaryResult: "r",
    });
    await testDb.db
      .insert(projectSkills)
      .values({ projectId, skillId: skill?.id ?? "" });

    await testDb.db.delete(projects).where(eq(projects.id, projectId));

    expect(await testDb.db.select().from(projectTranslations)).toEqual([]);
    expect(await testDb.db.select().from(projectSkills)).toEqual([]);
    expect(await testDb.db.select().from(skills)).toHaveLength(1);
  });
});
