import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MAX_PAGE_SIZE } from "@/db/limits";
import type { EducationContent } from "@/features/content/schemas";
import { ok } from "@/lib/result";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createEducationAdminRepository } from "./education-admin-repository";

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

const FRENCH = { degree: "Diplôme d'ingénieur", description: "Informatique" };
const ENGLISH = { degree: "Engineering degree", description: "" };

function input(overrides: Partial<EducationContent> = {}): EducationContent {
  return {
    school: "INSA Lyon",
    location: "Villeurbanne",
    logoMediaId: null,
    startedOn: "2018-09-01",
    endedOn: "2023-06-30",
    sortOrder: 0,
    translations: { fr: FRENCH },
    ...overrides,
  };
}

function repository() {
  return createEducationAdminRepository(testDb.db);
}

async function created(overrides: Partial<EducationContent> = {}) {
  const outcome = await repository().create(input(overrides));
  if (!outcome.ok || outcome.data.status !== "saved") {
    throw new Error("Not created");
  }
  return outcome.data.id;
}

async function slugs(): Promise<string[]> {
  const rows = await testDb.query<{ slug: string }>(
    "select slug from education order by created_at",
  );
  return rows.map((row) => row.slug);
}

describe("education admin repository", () => {
  it("creates an entry with its languages and a slug drawn from it, and finds it", async () => {
    const outcome = await repository().create(
      input({ translations: { fr: FRENCH, en: ENGLISH } }),
    );
    if (!outcome.ok || outcome.data.status !== "saved") {
      throw new Error("Not created");
    }

    expect(outcome.data).toEqual({
      status: "saved",
      id: outcome.data.id,
      isNew: true,
    });
    expect(await repository().find(outcome.data.id)).toEqual(
      ok({
        ...input({ translations: { fr: FRENCH, en: ENGLISH } }),
        id: outcome.data.id,
      }),
    );
    expect(await slugs()).toEqual(["insa-lyon-diplome-d-ingenieur"]);
  });

  it("numbers a slug already held, and keeps it through a rename", async () => {
    const id = await created();
    await created();

    await repository().update(id, input({ school: "INSA" }));

    expect(await slugs()).toEqual([
      "insa-lyon-diplome-d-ingenieur",
      "insa-lyon-diplome-d-ingenieur-2",
    ]);
  });

  it("stops where the public list does", async () => {
    await testDb.exec(
      `insert into education (slug, school, started_on) select 'e-' || n, 'School', '2020-01-01' from generate_series(1, ${String(MAX_PAGE_SIZE)}) as n`,
    );

    expect(await repository().create(input())).toEqual(ok({ status: "full" }));
  });

  it("lists the entries as the site does, latest first, each with its degree and English", async () => {
    await created({ startedOn: "2015-09-01", endedOn: "2018-06-30" });
    await created({
      school: "MIT",
      startedOn: "2023-09-01",
      endedOn: null,
      translations: {
        fr: { ...FRENCH, degree: "Master", description: "" },
        en: ENGLISH,
      },
    });
    // A French description its English lacks: the translation is partial.
    await created({
      school: "EPFL",
      startedOn: "2021-09-01",
      translations: { fr: FRENCH, en: ENGLISH },
    });

    const listed = await repository().list();

    expect(
      listed.ok &&
        listed.data.map(({ school, degree, endedOn, english }) => [
          school,
          degree,
          endedOn,
          english,
        ]),
    ).toEqual([
      ["MIT", "Master", null, "complete"],
      ["EPFL", "Diplôme d'ingénieur", "2023-06-30", "partial"],
      ["INSA Lyon", "Diplôme d'ingénieur", "2018-06-30", "missing"],
    ]);
  });

  it("updates an entry: its languages become the ones sent, the dropped one returned", async () => {
    const id = await created({ translations: { fr: FRENCH, en: ENGLISH } });

    expect(
      await repository().update(id, input({ location: null, endedOn: null })),
    ).toEqual(
      ok({
        status: "saved",
        id,
        isNew: false,
        diff: { removedTranslations: [{ locale: "en", ...ENGLISH }] },
      }),
    );
    const found = await repository().find(id);
    expect(found.ok && found.data).toMatchObject({
      location: null,
      endedOn: null,
      translations: { fr: FRENCH },
    });
    expect(
      await repository().update(
        "00000000-0000-4000-8000-000000000000",
        input(),
      ),
    ).toEqual(ok({ status: "not_found" }));
  });
});
