import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  bentoTiles,
  certifications,
  certificationTranslations,
  education,
  educationTranslations,
  skills,
} from "@/db/schema";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createCatalogRepository } from "./repository";

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
  return createCatalogRepository(testDb.db);
}

describe("listSkills", () => {
  it("lists skills by domain, then by their order", async () => {
    await testDb.db.insert(skills).values([
      { slug: "kerberos", name: "Kerberos", domain: "cyber", sortOrder: 1 },
      { slug: "react", name: "React", domain: "web", sortOrder: 2 },
      { slug: "typescript", name: "TypeScript", domain: "web", sortOrder: 1 },
      { slug: "rust", name: "Rust", domain: "low_level", featured: true },
    ]);

    const result = await repository().listSkills();

    expect(result.ok && result.data.map((skill) => skill.slug)).toEqual([
      "typescript",
      "react",
      "rust",
      "kerberos",
    ]);
    expect(result.ok && result.data[2]).toEqual({
      slug: "rust",
      name: "Rust",
      domain: "low_level",
      featured: true,
    });
  });
});

describe("listEducation", () => {
  it("lists education from the most recent, localized", async () => {
    const [older] = await testDb.db
      .insert(education)
      .values({
        slug: "lycee",
        school: "Lycée",
        startedOn: "2015-09-01",
        endedOn: "2018-06-30",
      })
      .returning();
    const [recent] = await testDb.db
      .insert(education)
      .values({ slug: "epitech", school: "Epitech", startedOn: "2020-09-01" })
      .returning();
    await testDb.db.insert(educationTranslations).values([
      { educationId: older?.id ?? "", locale: "fr", degree: "Bac" },
      { educationId: recent?.id ?? "", locale: "fr", degree: "Expert" },
      { educationId: recent?.id ?? "", locale: "en", degree: "Master" },
    ]);

    const result = await repository().listEducation("en");

    expect(result.ok && result.data).toMatchObject([
      { school: "Epitech", degree: "Master", isFallback: false },
      { school: "Lycée", degree: "Bac", isFallback: true, contentLocale: "fr" },
    ]);
  });
});

describe("listEducation ties", () => {
  it("breaks a tie on the start date by slug, so the order never shifts", async () => {
    for (const slug of ["b-school", "a-school"]) {
      const [row] = await testDb.db
        .insert(education)
        .values({ slug, school: slug, startedOn: "2020-09-01" })
        .returning();
      await testDb.db
        .insert(educationTranslations)
        .values({ educationId: row?.id ?? "", locale: "fr", degree: "D" });
    }

    const result = await repository().listEducation("fr");

    expect(result.ok && result.data.map((entry) => entry.school)).toEqual([
      "a-school",
      "b-school",
    ]);
  });
});

describe("listEducation without translations", () => {
  it("leaves out an entry with no translation at all", async () => {
    await testDb.db
      .insert(education)
      .values({ slug: "untranslated", school: "X", startedOn: "2020-01-01" });

    expect(await repository().listEducation("fr")).toEqual({
      ok: true,
      data: [],
    });
  });
});

describe("listCertifications", () => {
  it("lists certifications from the most recent, with their description", async () => {
    const [cert] = await testDb.db
      .insert(certifications)
      .values({
        slug: "oscp",
        name: "OSCP",
        issuer: "OffSec",
        issuedOn: "2025-03-01",
        verifyUrl: "https://verify.example/oscp",
      })
      .returning();
    await testDb.db.insert(certifications).values({
      slug: "older",
      name: "Older",
      issuer: "X",
      issuedOn: "2022-01-01",
    });
    await testDb.db.insert(certificationTranslations).values({
      certificationId: cert?.id ?? "",
      locale: "fr",
      description: "Pentest",
    });

    const result = await repository().listCertifications("fr");

    expect(result.ok && result.data).toMatchObject([
      { slug: "oscp", name: "OSCP", description: "Pentest" },
      { slug: "older", description: "" },
    ]);
  });
});

describe("listVisibleTiles", () => {
  it("returns the visible bento tiles in their order", async () => {
    await testDb.db.insert(bentoTiles).values([
      { kind: "contact", size: "sm", sortOrder: 3 },
      { kind: "identity", size: "xl", sortOrder: 1 },
      { kind: "cv", visible: false, sortOrder: 2 },
    ]);

    const result = await repository().listVisibleTiles();

    expect(result.ok && result.data).toEqual([
      { kind: "identity", size: "xl" },
      { kind: "contact", size: "sm" },
    ]);
  });
});
