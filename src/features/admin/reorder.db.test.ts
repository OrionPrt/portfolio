import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { skills } from "@/db/schema";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { reorderRows } from "./reorder";

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

const SKILL_ORDER = {
  table: skills,
  idColumn: skills.id,
  placeColumn: skills.sortOrder,
};

async function order(): Promise<string[]> {
  const rows = await testDb.query<{ slug: string }>(
    "select slug from skills order by sort_order, slug",
  );
  return rows.map((row) => row.slug);
}

describe("reorderRows", () => {
  it("gives each row its place in the list, in one statement", async () => {
    const rows = await testDb.db
      .insert(skills)
      .values([
        { slug: "a", name: "A", domain: "web", sortOrder: 0 },
        { slug: "b", name: "B", domain: "web", sortOrder: 1 },
        { slug: "c", name: "C", domain: "web", sortOrder: 2 },
      ])
      .returning({ id: skills.id });
    const [a, b, c] = rows.map((row) => row.id);

    await reorderRows(testDb.db, SKILL_ORDER, [c ?? "", a ?? "", b ?? ""]);
    expect(await order()).toEqual(["c", "a", "b"]);

    await reorderRows(testDb.db, SKILL_ORDER, []);
    expect(await order()).toEqual(["c", "a", "b"]);
  });
});
