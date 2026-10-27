import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ok } from "@/lib/result";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createProfileAdminRepository } from "./admin-repository";

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

const FRENCH = {
  headline: "Ingénieur",
  availability: "Disponible",
  pitch: "Je construis.",
  aboutMd: "## Parcours",
  lookingFor: null,
};
const ENGLISH = {
  headline: "Engineer",
  availability: "Available",
  pitch: "I build.",
  aboutMd: "",
  lookingFor: "A mission",
};

describe("profile admin repository", () => {
  it("has nothing to edit before the first save", async () => {
    expect(await createProfileAdminRepository(testDb.db).read()).toEqual(
      ok(undefined),
    );
  });

  it("saves the profile in both languages, and reads it back for editing", async () => {
    const profiles = createProfileAdminRepository(testDb.db);

    expect(
      await profiles.save({
        displayName: "Orion",
        location: "Lyon",
        translations: { fr: FRENCH, en: ENGLISH },
      }),
    ).toEqual(ok([]));

    expect(await profiles.read()).toEqual(
      ok({
        displayName: "Orion",
        location: "Lyon",
        translations: { fr: FRENCH, en: ENGLISH },
      }),
    );
  });

  it("drops a translation left out: the site falls back to French", async () => {
    const profiles = createProfileAdminRepository(testDb.db);
    await profiles.save({
      displayName: "Orion",
      location: null,
      translations: { fr: FRENCH, en: ENGLISH },
    });

    expect(
      await profiles.save({
        displayName: "Orion P.",
        location: null,
        translations: { fr: { ...FRENCH, pitch: "Autre." } },
      }),
    ).toEqual(ok([{ locale: "en", ...ENGLISH }]));

    expect(await profiles.read()).toEqual(
      ok({
        displayName: "Orion P.",
        location: null,
        translations: { fr: { ...FRENCH, pitch: "Autre." } },
      }),
    );
  });
});
