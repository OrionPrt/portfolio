import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MAX_PLATFORMS } from "@/db/limits";
import { platforms } from "@/db/schema";
import type { PlatformInput } from "@/features/content/schemas";
import { ok } from "@/lib/result";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createPlatformsAdminRepository } from "./admin-repository";

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

const HTB: PlatformInput = {
  name: "Hack The Box",
  profileUrl: "https://app.hackthebox.com/profile/1",
  rank: "Pro Hacker",
  points: 1250,
  updatedOn: "2026-10-30",
};

const ROOT_ME: PlatformInput = {
  name: "Root Me",
  profileUrl: null,
  rank: null,
  points: 3165,
  updatedOn: "2026-10-29",
};

async function created(platform: PlatformInput): Promise<string> {
  const outcome = await createPlatformsAdminRepository(testDb.db).create(
    platform,
  );
  if (!outcome.ok || outcome.data.status !== "saved") {
    throw new Error("Not created");
  }
  return outcome.data.id;
}

describe("platforms admin repository", () => {
  it("adds each platform at the end, and lists them in order", async () => {
    await created(HTB);
    await created(ROOT_ME);

    const listed = await createPlatformsAdminRepository(testDb.db).list();

    expect(listed.ok && listed.data.map((p) => [p.name, p.sortOrder])).toEqual([
      ["Hack The Box", 0],
      ["Root Me", 1],
    ]);
  });

  it("refuses a second platform of the same name, on its name", async () => {
    await created(HTB);
    const repository = createPlatformsAdminRepository(testDb.db);

    expect(await repository.create({ ...ROOT_ME, name: HTB.name })).toEqual(
      ok({ status: "conflict", field: "name" }),
    );
    const id = await created(ROOT_ME);
    expect(await repository.update(id, { ...ROOT_ME, name: HTB.name })).toEqual(
      ok({ status: "conflict", field: "name" }),
    );
  });

  it("updates a platform, keeping its own name free to reuse", async () => {
    const id = await created(HTB);
    const repository = createPlatformsAdminRepository(testDb.db);

    expect(
      await repository.update(id, {
        ...HTB,
        rank: "Elite Hacker",
        points: 2000,
      }),
    ).toEqual(ok({ status: "saved", id, isNew: false }));
    const listed = await repository.list();
    expect(listed.ok && listed.data[0]).toMatchObject({
      rank: "Elite Hacker",
      points: 2000,
    });
  });

  it("answers not found for a platform gone", async () => {
    expect(
      await createPlatformsAdminRepository(testDb.db).update(
        crypto.randomUUID(),
        HTB,
      ),
    ).toEqual(ok({ status: "not_found" }));
  });

  it("stops at the platforms the lists show", async () => {
    await testDb.db.insert(platforms).values(
      Array.from({ length: MAX_PLATFORMS }, (_, index) => ({
        name: `Platform ${String(index)}`,
        updatedOn: "2026-10-30",
      })),
    );

    expect(await createPlatformsAdminRepository(testDb.db).create(HTB)).toEqual(
      ok({ status: "full" }),
    );
  });

  it("reorders the platforms in one statement", async () => {
    const htb = await created(HTB);
    const rootMe = await created(ROOT_ME);
    const repository = createPlatformsAdminRepository(testDb.db);

    await repository.reorder([rootMe, htb]);

    expect(await repository.ids()).toEqual(ok([rootMe, htb]));
  });
});
