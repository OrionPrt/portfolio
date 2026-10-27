import { sql, type SQLWrapper } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { alongside } from "@/db/one-statement";
import { slugRedirects } from "@/db/schema";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import {
  createRedirectsRepository,
  reclaimWrite,
  renameWrites,
} from "./redirects-repository";

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

async function redirects() {
  const listed = await createRedirectsRepository(testDb.db).list();
  if (!listed.ok) {
    throw new Error("Not listed");
  }
  return listed.data.map(({ collection, fromSlug, toSlug }) => [
    collection,
    fromSlug,
    toSlug,
  ]);
}

/** The writes as one statement, as an entry's save runs them. */
async function apply(writes: readonly SQLWrapper[]): Promise<void> {
  const { db } = testDb;
  await db
    .with(...alongside(db, writes))
    .select({ done: sql`1` })
    .from(slugRedirects)
    .limit(1);
}

function rename(
  collection: "projects" | "experiences",
  from: string,
  to: string,
) {
  return apply(renameWrites(testDb.db, collection, from, to));
}

describe("redirects repository", () => {
  it("leads a renamed entry's old slug to its new one, per collection", async () => {
    await rename("projects", "old", "new");
    await rename("experiences", "old", "elsewhere");

    // An enum sorts in its declared order.
    expect(await redirects()).toEqual([
      ["projects", "old", "new"],
      ["experiences", "old", "elsewhere"],
    ]);
  });

  it("keeps chains flat: a slug renamed twice leads straight to the last one", async () => {
    await rename("projects", "a", "b");

    await rename("projects", "b", "c");

    expect(await redirects()).toEqual([
      ["projects", "a", "c"],
      ["projects", "b", "c"],
    ]);
  });

  it("renamed back, an entry takes its old slug again and leads the other one to it", async () => {
    await rename("projects", "a", "b");

    await rename("projects", "b", "a");

    expect(await redirects()).toEqual([["projects", "b", "a"]]);
  });

  it("gives an old slug back to an entry that takes it", async () => {
    await rename("projects", "a", "b");
    await rename("projects", "x", "y");

    await apply([reclaimWrite(testDb.db, "projects", "a")]);

    expect(await redirects()).toEqual([["projects", "x", "y"]]);
  });
});
