import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { skills } from "@/db/schema";
import { createRedirectsRepository } from "@/features/content/redirects-repository";
import type { ExperienceInput } from "@/features/content/schemas";
import { ok } from "@/lib/result";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createExperiencesAdminRepository } from "./admin-repository";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  await testDb.db.insert(skills).values([
    { slug: "react", name: "React", domain: "web" },
    { slug: "docker", name: "Docker", domain: "devops" },
  ]);
});

const FRENCH = {
  role: "Développeur",
  summaryContext: "Contexte",
  summaryAction: "Action",
  summaryResult: "Résultat",
  technicalMd: "",
};

const ENGLISH = { ...FRENCH, role: "Developer", summaryContext: "Context" };

function input(overrides: Partial<ExperienceInput> = {}): ExperienceInput {
  return {
    slug: "acme",
    company: "Acme",
    companyUrl: null,
    location: null,
    employmentType: "full_time",
    status: "draft",
    startedOn: "2024-01-01",
    endedOn: null,
    sortOrder: 0,
    skills: [],
    translations: { fr: FRENCH },
    ...overrides,
  };
}

function repository() {
  return createExperiencesAdminRepository(testDb.db);
}

async function created(overrides: Partial<ExperienceInput> = {}) {
  const outcome = await repository().create(input(overrides));
  if (!outcome.ok || outcome.data.status !== "saved") {
    throw new Error("Not created");
  }
  return outcome.data.id;
}

describe("experiences admin repository", () => {
  it("creates an experience with its languages and skills in order, and finds it", async () => {
    const fields = input({
      companyUrl: "https://acme.example",
      location: "Lyon",
      endedOn: "2024-12-31",
      skills: ["docker", "react"],
      translations: { fr: FRENCH, en: ENGLISH },
    });

    const outcome = await repository().create(fields);
    if (!outcome.ok || outcome.data.status !== "saved") {
      throw new Error("Not created");
    }

    expect(outcome.data).toMatchObject({ isNew: true, slugs: ["acme"] });
    expect(await repository().find(outcome.data.id)).toEqual(
      ok({ ...fields, id: outcome.data.id }),
    );
    expect(await repository().create(fields)).toEqual(
      ok({ status: "conflict", field: "slug" }),
    );
  });

  it("lists the current position first, then the latest, each with its role and English", async () => {
    await created({
      slug: "old",
      startedOn: "2019-01-01",
      endedOn: "2020-01-01",
    });
    await created({
      slug: "recent",
      startedOn: "2021-01-01",
      endedOn: "2022-01-01",
      translations: { fr: FRENCH, en: ENGLISH },
    });
    await created({
      slug: "current",
      startedOn: "2020-06-01",
      status: "published",
      translations: { fr: { ...FRENCH, role: "Ingénieur" } },
    });

    const listed = await repository().list();

    expect(
      listed.ok &&
        listed.data.map(({ slug, role, endedOn, status, english }) => [
          slug,
          role,
          endedOn,
          status,
          english,
        ]),
    ).toEqual([
      ["current", "Ingénieur", null, "published", "missing"],
      ["recent", "Développeur", "2022-01-01", "draft", "complete"],
      ["old", "Développeur", "2020-01-01", "draft", "missing"],
    ]);
  });

  it("updates an experience: languages and skills become the ones sent", async () => {
    const id = await created({
      skills: ["react"],
      translations: { fr: FRENCH, en: ENGLISH },
    });

    expect(
      await repository().update(
        id,
        input({ company: "Acme SA", skills: ["docker"] }),
      ),
    ).toEqual(
      ok({
        status: "saved",
        id,
        isNew: false,
        slugs: ["acme"],
        diff: { removedTranslations: [{ locale: "en", ...ENGLISH }] },
      }),
    );
    const found = await repository().find(id);
    expect(found.ok && found.data).toMatchObject({
      company: "Acme SA",
      skills: ["docker"],
    });
    expect(
      await repository().update(
        "00000000-0000-4000-8000-000000000000",
        input(),
      ),
    ).toEqual(ok({ status: "not_found" }));
  });

  it("leads a published experience's old slug to its new one", async () => {
    const id = await created({ status: "published" });

    expect(
      await repository().update(
        id,
        input({ slug: "acme-sa", status: "published" }),
      ),
    ).toMatchObject(ok({ slugs: ["acme-sa", "acme"] }));
    const listed = await createRedirectsRepository(testDb.db).list();
    expect(listed).toEqual(
      ok([{ collection: "experiences", fromSlug: "acme", toSlug: "acme-sa" }]),
    );
  });
});
