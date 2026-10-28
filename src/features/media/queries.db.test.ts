import { cacheTag } from "next/cache";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { withDatabase } from "@/db/client";
import type { Database } from "@/db/types";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { getMarkdownImages } from "./queries";

const database = vi.hoisted(() => ({
  current: undefined as Database | undefined,
}));

// Outside Next.js, the cache APIs only need to be observed.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/db/client", () => ({
  withDatabase: vi.fn((read: (db: Database) => Promise<unknown>) => {
    if (database.current === undefined) {
      throw new Error("The test database is not ready.");
    }
    return read(database.current);
  }),
}));

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
  database.current = testDb.db;
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  vi.clearAllMocks();
  await testDb.reset();
});

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("getMarkdownImages", () => {
  it("reads nothing for a text without images", async () => {
    expect(await getMarkdownImages("Juste du texte.", "fr")).toEqual({});
    expect(withDatabase).not.toHaveBeenCalled();
  });

  it("loads the images a text shows, tagged so an edited text shows at once", async () => {
    await testDb.exec(
      `insert into media (id, sha256, pathname, width, height, variants)
       values ('${ID}', '${"a".repeat(64)}', 'media/${ID}', 480, 270,
         '[{"width":480,"height":270,"url":"/m/480.webp","bytes":1}]');
       insert into media_translations (media_id, locale, alt)
       values ('${ID}', 'fr', 'Schéma'), ('${ID}', 'en', 'Diagram')`,
    );

    const images = await getMarkdownImages(`![x](media:${ID})`, "fr");

    expect(Object.keys(images)).toEqual([ID]);
    expect(cacheTag).toHaveBeenCalledWith("media");
  });

  it("shows the descriptions rather than fail when the images cannot be read", async () => {
    vi.mocked(withDatabase).mockResolvedValueOnce({
      ok: false,
      error: { code: "DB_UNAVAILABLE", message: "down" },
    });

    expect(await getMarkdownImages(`![x](media:${ID})`, "fr")).toEqual({});
  });
});
