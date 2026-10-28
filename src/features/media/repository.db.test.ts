import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ok } from "@/lib/result";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createMediaRepository } from "./repository";

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

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const GONE = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

describe("media repository", () => {
  it("finds the images a text names, each with its text in the page's language", async () => {
    await testDb.exec(
      `insert into media (id, sha256, pathname, width, height, variants)
       values ('${ID}', '${"a".repeat(64)}', 'media/${ID}', 480, 270,
         '[{"width":480,"height":270,"url":"/m/480.webp","bytes":1}]');
       insert into media_translations (media_id, locale, alt)
       values ('${ID}', 'fr', 'Schéma'), ('${ID}', 'en', 'Diagram')`,
    );
    const media = createMediaRepository(testDb.db);

    expect(await media.findByIds([ID, GONE], "en")).toEqual(
      ok({
        [ID]: {
          alt: "Diagram",
          width: 480,
          height: 270,
          variants: [{ width: 480, height: 270, url: "/m/480.webp", bytes: 1 }],
        },
      }),
    );
    expect(await media.findByIds([], "fr")).toEqual(ok({}));
  });
});
