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

import type { Database } from "@/db/types";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import {
  insertExperience,
  insertProject,
} from "../../../test/fixtures/content";
import { movedSlug } from "./moved-slugs";

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

describe("movedSlug", () => {
  it("leads an old slug to its published entry, in its own collection only", async () => {
    await insertProject(testDb.db, { slug: "new-name" });
    await insertProject(testDb.db, { slug: "draft", status: "draft" });
    await insertExperience(testDb.db, { slug: "acme" });
    await testDb.exec(
      `insert into slug_redirects (collection, from_slug, to_slug) values
       ('projects', 'old-name', 'new-name'), ('projects', 'older', 'draft'),
       ('experiences', 'initech', 'acme')`,
    );

    expect(await movedSlug("projects", "old-name")).toBe("new-name");
    expect(await movedSlug("projects", "older")).toBeUndefined();
    expect(await movedSlug("projects", "initech")).toBeUndefined();
    expect(await movedSlug("experiences", "initech")).toBe("acme");
    expect(cacheTag).toHaveBeenCalledWith("projects", "experiences");
  });

  it("reads nothing for what cannot be a slug", async () => {
    expect(await movedSlug("projects", "../admin")).toBeUndefined();
    expect(cacheTag).not.toHaveBeenCalled();
  });
});
