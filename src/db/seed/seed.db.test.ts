import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProjectRepository } from "@/features/projects/repository";

import { SEED_CONTENT } from "../../../scripts/seed/content";
import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { parseSeedContent, type SeedContentInput } from "./schema";
import { seedDatabase } from "./seed";

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

const SUMMARY = {
  summaryContext: "Contexte",
  summaryAction: "Action",
  summaryResult: "Résultat",
};

const CONTENT: SeedContentInput = {
  profile: {
    displayName: "Orion",
    translations: {
      fr: { headline: "Ingénieur", availability: "Disponible", pitch: "Pitch" },
    },
  },
  socialLinks: [{ kind: "github", url: "https://github.com/OrionPrt" }],
  skills: [
    { slug: "typescript", name: "TypeScript", domain: "web" },
    { slug: "rust", name: "Rust", domain: "low_level" },
  ],
  projects: [
    {
      slug: "portfolio",
      domain: "web",
      status: "published",
      skills: ["typescript", "rust"],
      translations: {
        fr: { title: "Portfolio", tagline: "Accroche", ...SUMMARY },
      },
    },
  ],
  experiences: [
    {
      slug: "acme",
      company: "Acme",
      employmentType: "full_time",
      startedOn: "2024-01-01",
      skills: ["rust"],
      translations: { fr: { role: "Développeur", ...SUMMARY } },
    },
  ],
  education: [
    {
      slug: "epitech",
      school: "Epitech",
      startedOn: "2020-09-01",
      translations: { fr: { degree: "Expert" } },
    },
  ],
  certifications: [
    {
      slug: "oscp",
      name: "OSCP",
      issuer: "OffSec",
      issuedOn: "2025-01-01",
      translations: { fr: {} },
    },
  ],
  tiles: [{ kind: "identity", size: "xl" }],
};

const TABLES = [
  "profile",
  "profile_translations",
  "social_links",
  "skills",
  "projects",
  "project_translations",
  "project_skills",
  "experiences",
  "experience_translations",
  "experience_skills",
  "education",
  "education_translations",
  "certifications",
  "certification_translations",
  "bento_tiles",
] as const;

async function rowCounts(): Promise<Record<string, number>> {
  const entries = await Promise.all(
    TABLES.map(async (table) => {
      const [row] = await testDb.query<{ n: number }>(
        `select count(*)::int as n from ${table}`,
      );
      return [table, row?.n ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries);
}

async function seed(input: SeedContentInput) {
  const parsed = parseSeedContent(input);
  if (!parsed.ok) {
    throw new Error(parsed.error.issues.join("\n"));
  }
  return seedDatabase(testDb.db, parsed.data);
}

async function projectSkillSlugs(slug: string) {
  const result = await createProjectRepository(testDb.db).findPublishedBySlug(
    slug,
    "fr",
  );
  return result.ok ? result.data?.skills.map((skill) => skill.slug) : [];
}

describe("seedDatabase", () => {
  it("writes every entity of the content", async () => {
    await seed(CONTENT);

    // One row per table, except the two skills and the project's links to them.
    expect(await rowCounts()).toEqual({
      ...Object.fromEntries(TABLES.map((table) => [table, 1])),
      skills: 2,
      project_skills: 2,
    });
    expect(await projectSkillSlugs("portfolio")).toEqual([
      "typescript",
      "rust",
    ]);
  });

  it("is idempotent: running it again updates rows instead of duplicating them", async () => {
    await seed(CONTENT);
    const before = await rowCounts();
    const [project] = await testDb.query<{ id: string }>(
      "select id from projects",
    );

    await seed({
      ...CONTENT,
      projects: CONTENT.projects.map((p) => ({
        ...p,
        translations: { fr: { title: "Renamed", tagline: "x", ...SUMMARY } },
      })),
    });

    expect(await rowCounts()).toEqual(before);
    expect(
      await testDb.query<{ id: string; title: string }>(
        "select p.id, t.title from projects p join project_translations t on t.project_id = p.id",
      ),
    ).toEqual([{ id: project?.id, title: "Renamed" }]);
  });

  it("updates every entity on a re-seed, and clears an optional field left out", async () => {
    const [project] = CONTENT.projects;
    const [experience] = CONTENT.experiences;
    const [entry] = CONTENT.education;
    const [certification] = CONTENT.certifications;
    if (!project || !experience || !entry || !certification) {
      throw new Error("The test content must hold one of each entity.");
    }
    await seed({
      ...CONTENT,
      profile: { ...CONTENT.profile, location: "Paris" },
      projects: [{ ...project, repoUrl: "https://github.com/OrionPrt/x" }],
    });

    await seed({
      ...CONTENT,
      profile: {
        displayName: "Orion P.",
        translations: {
          fr: { headline: "Nouveau", availability: "Non", pitch: "P" },
        },
      },
      socialLinks: [
        { kind: "github", url: "https://github.com/other", sortOrder: 5 },
      ],
      skills: [
        { slug: "typescript", name: "TS", domain: "web", featured: true },
        { slug: "rust", name: "Rust", domain: "low_level" },
      ],
      projects: [{ ...project, domain: "cyber" }],
      experiences: [
        { ...experience, company: "Acme Corp", endedOn: "2025-01-01" },
      ],
      education: [{ ...entry, school: "EPITECH" }],
      certifications: [{ ...certification, issuer: "Offensive Security" }],
      tiles: [{ kind: "identity", size: "sm", visible: false }],
    });

    expect(
      await testDb.query(
        "select display_name, location, headline from profile join profile_translations on profile_id = id",
      ),
    ).toEqual([
      { display_name: "Orion P.", location: null, headline: "Nouveau" },
    ]);
    expect(
      await testDb.query("select url, sort_order from social_links"),
    ).toEqual([{ url: "https://github.com/other", sort_order: 5 }]);
    expect(
      await testDb.query(
        "select name, featured from skills where slug = 'typescript'",
      ),
    ).toEqual([{ name: "TS", featured: true }]);
    expect(await testDb.query("select domain, repo_url from projects")).toEqual(
      [{ domain: "cyber", repo_url: null }],
    );
    expect(
      await testDb.query(
        "select company, ended_on::text as ended_on from experiences",
      ),
    ).toEqual([{ company: "Acme Corp", ended_on: "2025-01-01" }]);
    expect(await testDb.query("select school from education")).toEqual([
      { school: "EPITECH" },
    ]);
    expect(await testDb.query("select issuer from certifications")).toEqual([
      { issuer: "Offensive Security" },
    ]);
    expect(await testDb.query("select size, visible from bento_tiles")).toEqual(
      [{ size: "sm", visible: false }],
    );
  });

  it("writes nothing when a step fails midway", async () => {
    const parsed = parseSeedContent(CONTENT);
    if (!parsed.ok) {
      throw new Error("The test content must be valid.");
    }
    // Skips validation on purpose: the project now links to a skill that does not exist.
    const broken = {
      ...parsed.data,
      projects: parsed.data.projects.map((p) => ({ ...p, skills: ["go"] })),
    };

    await expect(seedDatabase(testDb.db, broken)).rejects.toThrow(
      'Unknown skill "go".',
    );
    expect(await rowCounts()).toEqual(
      Object.fromEntries(TABLES.map((table) => [table, 0])),
    );
  });

  it("replaces the skill links of a seeded entity, in the given order", async () => {
    await seed(CONTENT);

    await seed({
      ...CONTENT,
      projects: CONTENT.projects.map((p) => ({ ...p, skills: ["rust"] })),
    });

    expect(await projectSkillSlugs("portfolio")).toEqual(["rust"]);
  });
});

describe("parseSeedContent", () => {
  it("rejects a reference to a skill the content does not define", () => {
    const result = parseSeedContent({
      ...CONTENT,
      projects: CONTENT.projects.map((p) => ({ ...p, skills: ["go"] })),
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.issues).toEqual([
      'projects.0.skills.0: unknown skill "go"',
    ]);
  });

  it("rejects two entities sharing a slug", () => {
    const result = parseSeedContent({
      ...CONTENT,
      skills: [
        ...CONTENT.skills,
        { slug: "rust", name: "Rust", domain: "web" },
      ],
    });

    expect(!result.ok && result.error.issues).toEqual([
      'skills.2.slug: duplicate value "rust"',
    ]);
  });
});

describe("the repository's seed content", () => {
  it("is valid and seeds a blank database twice without changes", async () => {
    const parsed = parseSeedContent(SEED_CONTENT);
    expect(parsed.ok || parsed.error.issues).toBe(true);
    if (!parsed.ok) {
      return;
    }

    await seedDatabase(testDb.db, parsed.data);
    const first = await rowCounts();
    await seedDatabase(testDb.db, parsed.data);

    expect(await rowCounts()).toEqual(first);
    expect(first.profile).toBe(1);
    expect(first.bento_tiles).toBeGreaterThan(0);
  });
});
