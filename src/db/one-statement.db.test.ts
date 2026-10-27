import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { projects, projectTranslations } from "@/db/schema";

import { createTestDatabase, type TestDatabase } from "../../test/db";
import { alongside } from "./one-statement";

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

function translation(projectId: string) {
  return testDb.db.insert(projectTranslations).values({
    projectId,
    locale: "fr",
    title: "Démo",
    tagline: "Accroche",
    summaryContext: "Contexte",
    summaryAction: "Action",
    summaryResult: "Résultat",
  });
}

describe("alongside", () => {
  it("runs the writes with the statement, a row before its parent", async () => {
    const { db } = testDb;
    const id = randomUUID();

    const created = await db
      .with(...alongside(db, [translation(id)]))
      .insert(projects)
      .values({ id, slug: "demo", domain: "web" })
      .returning({ id: projects.id });

    expect(created).toEqual([{ id }]);
    expect(
      await testDb.query("select title from project_translations"),
    ).toEqual([{ title: "Démo" }]);
  });

  it("undoes every write when one fails", async () => {
    const { db } = testDb;
    const id = randomUUID();

    await expect(
      db
        .with(...alongside(db, [translation(id)]))
        .insert(projects)
        .values({ id, slug: "Not A Slug", domain: "web" }),
    ).rejects.toThrow();

    expect(await testDb.query("select 1 from project_translations")).toEqual(
      [],
    );
  });
});
