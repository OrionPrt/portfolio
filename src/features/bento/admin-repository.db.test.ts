import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { bentoTiles } from "@/db/schema";
import { createCatalogRepository } from "@/features/catalog/repository";
import { ok } from "@/lib/result";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createBentoAdminRepository } from "./admin-repository";
import type { TileSetting } from "./layout";

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

const LAYOUT: readonly TileSetting[] = [
  { kind: "identity", size: "xl", visible: true },
  { kind: "stack", size: "md", visible: true },
  { kind: "featured_project", size: "lg", visible: false },
  { kind: "current_experience", size: "sm", visible: true },
  { kind: "cyber_stats", size: "sm", visible: true },
  { kind: "latest_post", size: "md", visible: true },
  { kind: "certifications", size: "md", visible: true },
  { kind: "contact", size: "sm", visible: true },
];

describe("bento admin repository", () => {
  it("lists every tile it arranges, hidden at their smallest size when the table is empty", async () => {
    const layout = await createBentoAdminRepository(testDb.db).layout();

    expect(layout.ok && layout.data.map((tile) => tile.kind)).toEqual([
      "identity",
      "featured_project",
      "current_experience",
      "stack",
      "cyber_stats",
      "latest_post",
      "certifications",
      "contact",
    ]);
    expect(layout.ok && layout.data[0]).toEqual({
      kind: "identity",
      size: "lg",
      visible: true,
    });
    expect(layout.ok && layout.data[1]?.visible).toBe(false);
  });

  it("saves the order, sizes and visibility in one go, as the hub reads them", async () => {
    const bento = createBentoAdminRepository(testDb.db);

    expect(await bento.save(LAYOUT)).toEqual(
      ok({
        status: "saved",
        id: "layout",
        isNew: false,
        diff: {
          tiles:
            "identity:xl, stack:md, featured_project:lg:hidden, current_experience:sm, cyber_stats:sm, latest_post:md, certifications:md, contact:sm",
        },
      }),
    );

    expect(await bento.layout()).toEqual(ok(LAYOUT));
    expect(await createCatalogRepository(testDb.db).listVisibleTiles()).toEqual(
      ok(
        LAYOUT.filter((tile) => tile.visible).map(({ kind, size }) => ({
          kind,
          size,
        })),
      ),
    );
  });

  it("rewrites a saved layout, and leaves the tiles not built yet hidden", async () => {
    await testDb.db.insert(bentoTiles).values([
      { kind: "cv", size: "md", sortOrder: 0, visible: false },
      { kind: "contact", size: "md", sortOrder: 1, visible: false },
    ]);
    const bento = createBentoAdminRepository(testDb.db);

    await bento.save(LAYOUT);
    await bento.save([...LAYOUT].reverse());

    expect(await bento.layout()).toEqual(ok([...LAYOUT].reverse()));
    const [cv] = await testDb.db
      .select()
      .from(bentoTiles)
      .where(eq(bentoTiles.kind, "cv"));
    expect(cv).toMatchObject({ size: "md", visible: false });
  });
});
