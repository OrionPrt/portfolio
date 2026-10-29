import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  certifications,
  certificationTranslations,
  education,
  educationTranslations,
  experienceTranslations,
  profile,
  profileTranslations,
} from "@/db/schema";
import { PLACEHOLDER } from "@/db/seed/placeholders";
import { createMediaAdminRepository } from "@/features/media/admin-repository";
import { ok } from "@/lib/result";

import {
  insertExperience,
  insertProject,
} from "../../../test/fixtures/content";
import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createDashboardRepository } from "./dashboard-repository";

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

const MEDIA_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

async function insertMedia(): Promise<string> {
  await createMediaAdminRepository(testDb.db).create({
    id: MEDIA_ID,
    sha256: "a".repeat(64),
    pathname: `media/${MEDIA_ID}`,
    width: 960,
    height: 540,
    variants: [
      { width: 960, height: 540, url: `/m/${MEDIA_ID}/960.webp`, bytes: 30 },
    ],
    alt: { fr: "Une capture", en: "A screenshot" },
  });
  return MEDIA_ID;
}

const PROFILE_TEXT = {
  headline: "Développeur",
  availability: "Disponible",
  pitch: "Je construis des sites.",
  aboutMd: "Bonjour.",
  lookingFor: "Un premier poste",
};

function toDo() {
  return createDashboardRepository(testDb.db).contentToDo();
}

describe("dashboard repository", () => {
  it("has nothing to say about an empty database", async () => {
    expect(await toDo()).toEqual(
      ok({ toTranslate: [], drafts: [], placeholders: [], withoutImage: [] }),
    );
  });

  it("lists the entries whose English is missing or partial, and the drafts", async () => {
    const cover = await insertMedia();
    const done = await insertProject(testDb.db, {
      slug: "done",
      coverMediaId: cover,
    });
    const draft = await insertProject(
      testDb.db,
      { slug: "draft", status: "draft", coverMediaId: cover },
      ["fr"],
    );
    await testDb.db.insert(profile).values({ id: 1, displayName: "Orion" });
    await testDb.db.insert(profileTranslations).values([
      { profileId: 1, locale: "fr", ...PROFILE_TEXT },
      // The French says what is looked for: the English should too.
      { profileId: 1, locale: "en", ...PROFILE_TEXT, lookingFor: null },
    ]);

    const result = await toDo();

    expect(result.ok && result.data.toTranslate).toEqual([
      { kind: "profile", id: "1", label: "Orion", english: "partial" },
      {
        kind: "project",
        id: draft,
        label: "draft (fr)",
        english: "missing",
      },
    ]);
    expect(result.ok && result.data.drafts).toEqual([
      { kind: "project", id: draft, label: "draft (fr)" },
    ]);
    expect(JSON.stringify(result)).not.toContain(done);
  });

  it("finds the text still marked to complete, in any language or column", async () => {
    const experience = await insertExperience(testDb.db, { slug: "acme" });
    await testDb.db
      .update(experienceTranslations)
      .set({ summaryAction: `Ce que j'y ai fait ${PLACEHOLDER}` });
    const [school] = await testDb.db
      .insert(education)
      .values({
        slug: "ecole",
        school: PLACEHOLDER,
        startedOn: "2020-09-01",
      })
      .returning({ id: education.id });
    await testDb.db.insert(educationTranslations).values({
      educationId: school?.id ?? "",
      locale: "fr",
      degree: "Licence",
    });

    const result = await toDo();

    expect(result.ok && result.data.placeholders).toEqual([
      {
        kind: "experience",
        id: experience,
        label: "acme role (fr) · acme company",
      },
      { kind: "education", id: school?.id, label: `Licence · ${PLACEHOLDER}` },
    ]);
  });

  it("lists the entries without their image", async () => {
    const badge = await insertMedia();
    const project = await insertProject(testDb.db, { slug: "bare" });
    await testDb.db.insert(certifications).values([
      {
        slug: "oscp",
        name: "OSCP",
        issuer: "OffSec",
        issuedOn: "2025-03-01",
        badgeMediaId: badge,
      },
      { slug: "ccna", name: "CCNA", issuer: "Cisco", issuedOn: "2024-06-01" },
    ]);
    const rows = await testDb.query<{ id: string; slug: string }>(
      "select id, slug from certifications",
    );
    await testDb.db.insert(certificationTranslations).values(
      rows.map((row) => ({
        certificationId: row.id,
        locale: "fr" as const,
        description: "",
      })),
    );

    const result = await toDo();

    expect(result.ok && result.data.withoutImage).toEqual([
      { kind: "project", id: project, label: "bare (fr)" },
      {
        kind: "certification",
        id: rows.find((row) => row.slug === "ccna")?.id,
        label: "CCNA (2024)",
      },
    ]);
  });
});

describe("dashboard media summary", () => {
  it("counts the images, and those nothing shows", async () => {
    const dashboard = createDashboardRepository(testDb.db);
    expect(await dashboard.media()).toEqual(ok({ total: 0, unused: 0 }));

    await insertMedia();

    expect(await dashboard.media()).toEqual(ok({ total: 1, unused: 1 }));
    await insertProject(testDb.db, { slug: "shown", coverMediaId: MEDIA_ID });
    expect(await dashboard.media()).toEqual(ok({ total: 1, unused: 0 }));
  });
});
