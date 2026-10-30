import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { platforms } from "@/db/schema";
import { ok } from "@/lib/result";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createPlatformsRepository } from "./repository";

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

describe("platforms repository", () => {
  it("lists the platforms in the admin's order, with what each shows", async () => {
    await testDb.db.insert(platforms).values([
      { name: "Root Me", points: 3165, updatedOn: "2026-10-29", sortOrder: 1 },
      {
        name: "Hack The Box",
        profileUrl: "https://app.hackthebox.com/profile/1",
        rank: "Pro Hacker",
        updatedOn: "2026-10-30",
        sortOrder: 0,
      },
    ]);

    expect(await createPlatformsRepository(testDb.db).list()).toEqual(
      ok([
        {
          name: "Hack The Box",
          profileUrl: "https://app.hackthebox.com/profile/1",
          rank: "Pro Hacker",
          points: null,
          updatedOn: "2026-10-30",
        },
        {
          name: "Root Me",
          profileUrl: null,
          rank: null,
          points: 3165,
          updatedOn: "2026-10-29",
        },
      ]),
    );
  });

  it("reads an empty list when there is none yet", async () => {
    expect(await createPlatformsRepository(testDb.db).list()).toEqual(ok([]));
  });
});
