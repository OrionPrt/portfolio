import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { education } from "@/db/schema";
import { MAX_SLUG_LENGTH } from "@/lib/slug";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { freeSlug } from "./free-slug";

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

const EDUCATION_SLUGS = { table: education, slugColumn: education.slug };

async function taken(...slugs: string[]): Promise<void> {
  await testDb.db
    .insert(education)
    .values(
      slugs.map((slug) => ({ slug, school: slug, startedOn: "2020-01-01" })),
    );
}

describe("freeSlug", () => {
  it("keeps the slug while no one holds it, else numbers it from 2", async () => {
    expect(await freeSlug(testDb.db, EDUCATION_SLUGS, "insa")).toBe("insa");

    await taken("insa", "insa-2", "insa-lyon");
    expect(await freeSlug(testDb.db, EDUCATION_SLUGS, "insa")).toBe("insa-3");
  });

  it("shortens a long slug to make room for its number", async () => {
    const long = `${"a".repeat(MAX_SLUG_LENGTH - 2)}-b`;
    await taken(long);

    const slug = await freeSlug(testDb.db, EDUCATION_SLUGS, long);

    expect(slug).toHaveLength(MAX_SLUG_LENGTH);
    expect(slug).toBe(`${"a".repeat(MAX_SLUG_LENGTH - 2)}-2`);
  });
});
