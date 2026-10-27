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
import { err } from "@/lib/result";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import {
  insertExperience,
  insertProject,
} from "../../../test/fixtures/content";
import { loadPublishedSlugs } from "./published-slugs";

const database = vi.hoisted(() => ({
  current: undefined as Database | undefined,
}));

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

describe("loadPublishedSlugs", () => {
  it("lists the published project and experience slugs, and the redirects", async () => {
    await insertProject(testDb.db, { slug: "portfolio" });
    await insertProject(testDb.db, { slug: "draft", status: "draft" });
    await insertExperience(testDb.db, { slug: "acme" });
    await testDb.exec(
      "insert into slug_redirects (collection, from_slug, to_slug) values ('projects', 'old-portfolio', 'portfolio')",
    );

    expect(await loadPublishedSlugs()).toEqual({
      ok: true,
      data: {
        published: { projects: ["portfolio"], experiences: ["acme"] },
        redirects: [
          {
            collection: "projects",
            fromSlug: "old-portfolio",
            toSlug: "portfolio",
          },
        ],
      },
    });
  });

  it("fails as a whole when the database is down", async () => {
    vi.mocked(withDatabase).mockResolvedValueOnce(
      err({ code: "DB_UNAVAILABLE", message: "down" }),
    );

    expect((await loadPublishedSlugs()).ok).toBe(false);
  });
});
