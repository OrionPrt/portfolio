import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import {
  education,
  media,
  mediaTranslations,
  profile,
  projects,
  projectSkills,
  projectTranslations,
  skills,
  slugRedirects,
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

const VARIANT = { width: 480, height: 270, url: "/m/480.webp", bytes: 1000 };

function newMedia(overrides: Partial<typeof media.$inferInsert> = {}) {
  return testDb.db
    .insert(media)
    .values({
      sha256: "a".repeat(64),
      pathname: "media/one",
      width: 480,
      height: 270,
      variants: [VARIANT],
      ...overrides,
    })
    .returning();
}

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
      "admin_sessions",
      "admin_users",
      "audit_logs",
      "bento_tiles",
      "certification_translations",
      "certifications",
      "contact_messages",
      "education",
      "education_translations",
      "experience_skills",
      "experience_translations",
      "experiences",
      "login_throttles",
      "media",
      "media_translations",
      "profile",
      "profile_translations",
      "project_skills",
      "project_translations",
      "projects",
      "recovery_codes",
      "skills",
      "slug_redirects",
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
    // A query would fill in a visitor's message: an address only.
    ["email", "mailto:hello@example.com?subject=x"],
    ["email", "mailto:hello@example.com#x"],
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

  it.each([
    [{ fromSlug: "Old", toSlug: "new" }, "slug_redirects_from_slug_format"],
    [{ fromSlug: "old", toSlug: "new/x" }, "slug_redirects_to_slug_format"],
    [{ fromSlug: "same", toSlug: "same" }, "slug_redirects_not_to_itself"],
  ] as const)("refuses the redirect %j", async (redirect, constraint) => {
    await expectRefusedBy(
      testDb.db
        .insert(slugRedirects)
        .values({ collection: "projects", ...redirect }),
      constraint,
    );
  });

  it("keeps one redirect per old slug and collection", async () => {
    const redirect = {
      collection: "projects",
      fromSlug: "old",
      toSlug: "new",
    } as const;
    await testDb.db.insert(slugRedirects).values(redirect);
    await testDb.db
      .insert(slugRedirects)
      .values({ ...redirect, collection: "experiences" });

    await expectRefusedBy(
      testDb.db.insert(slugRedirects).values({ ...redirect, toSlug: "other" }),
      "slug_redirects_from_idx",
    );
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

  it.each([
    [{ sha256: "A".repeat(64) }, "media_sha256_format"],
    [{ width: 0 }, "media_dimensions_positive"],
    [{ variants: [] }, "media_variants_count"],
  ])("refuses a media row such as %j", async (overrides, constraint) => {
    await expectRefusedBy(newMedia(overrides), constraint);
  });

  it("stores the same image once", async () => {
    await newMedia();

    await expectRefusedBy(
      newMedia({ pathname: "media/two" }),
      "media_sha256_unique",
    );
  });

  it("keeps an image while an entry shows it, and its alt texts go with it", async () => {
    const [image] = await newMedia();
    const mediaId = image?.id ?? "";
    await testDb.db.insert(mediaTranslations).values([
      { mediaId, locale: "fr", alt: "Capture" },
      { mediaId, locale: "en", alt: "Screenshot" },
    ]);
    await expectRefusedBy(
      testDb.db.insert(mediaTranslations).values({
        mediaId,
        locale: "fr",
        alt: "  ",
      }),
      "media_translations_alt_not_blank",
    );
    const [project] = await newProject({ coverMediaId: mediaId });

    await expectRefusedBy(
      testDb.db.delete(media).where(eq(media.id, mediaId)),
      "projects_cover_media_id_media_id_fk",
    );

    await testDb.db
      .update(projects)
      .set({ coverMediaId: null })
      .where(eq(projects.id, project?.id ?? ""));
    await testDb.db.delete(media).where(eq(media.id, mediaId));
    expect(await testDb.db.select().from(mediaTranslations)).toEqual([]);
  });
});
