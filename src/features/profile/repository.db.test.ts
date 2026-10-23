import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { profile, profileTranslations, socialLinks } from "@/db/schema";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createProfileRepository } from "./repository";

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

async function insertProfile(locales: readonly ("fr" | "en")[]) {
  await testDb.db
    .insert(profile)
    .values({ displayName: "Orion", location: "France" });
  await testDb.db.insert(profileTranslations).values(
    locales.map((locale) => ({
      profileId: 1,
      locale,
      headline: `headline (${locale})`,
      availability: `availability (${locale})`,
      pitch: `pitch (${locale})`,
    })),
  );
}

describe("getProfile", () => {
  it("returns the localized profile with its visible links in order", async () => {
    await insertProfile(["fr", "en"]);
    await testDb.db.insert(socialLinks).values([
      { kind: "linkedin", url: "https://linkedin.com/in/x", sortOrder: 2 },
      { kind: "github", url: "https://github.com/OrionPrt", sortOrder: 1 },
      { kind: "website", url: "https://hidden.example", visible: false },
    ]);

    const result = await createProfileRepository(testDb.db).getProfile("en");

    expect(result.ok && result.data).toMatchObject({
      displayName: "Orion",
      location: "France",
      headline: "headline (en)",
      pitch: "pitch (en)",
      isFallback: false,
      socialLinks: [
        { kind: "github", url: "https://github.com/OrionPrt" },
        { kind: "linkedin", url: "https://linkedin.com/in/x" },
      ],
    });
  });

  it("falls back to French when English is missing", async () => {
    await insertProfile(["fr"]);

    const result = await createProfileRepository(testDb.db).getProfile("en");

    expect(result.ok && result.data).toMatchObject({
      headline: "headline (fr)",
      isFallback: true,
    });
  });

  it("returns undefined before the profile is seeded", async () => {
    expect(await createProfileRepository(testDb.db).getProfile("fr")).toEqual({
      ok: true,
      data: undefined,
    });
  });
});
