import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ok } from "@/lib/result";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createSocialLinksAdminRepository } from "./social-links-admin-repository";

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

const GITHUB = {
  kind: "github",
  url: "https://github.com/orion",
  visible: true,
  sortOrder: 0,
} as const;
const EMAIL = {
  kind: "email",
  url: "mailto:orion@example.com",
  visible: true,
  sortOrder: 0,
} as const;

async function created(link: typeof GITHUB | typeof EMAIL): Promise<string> {
  const outcome = await createSocialLinksAdminRepository(testDb.db).create(
    link,
  );
  if (!outcome.ok || outcome.data.status !== "saved") {
    throw new Error("Not created");
  }
  return outcome.data.id;
}

describe("social links admin repository", () => {
  it("adds each kind once, at the end", async () => {
    const links = createSocialLinksAdminRepository(testDb.db);
    const github = await created(GITHUB);
    const email = await created(EMAIL);

    expect(
      await links.create({ ...GITHUB, url: "https://github.com/other" }),
    ).toEqual(ok({ status: "conflict", field: "kind" }));
    expect(await links.ids()).toEqual(ok([github, email]));
  });

  it("updates the address and visibility, never the kind", async () => {
    const links = createSocialLinksAdminRepository(testDb.db);
    const github = await created(GITHUB);

    expect(
      await links.update(github, {
        ...GITHUB,
        url: "https://github.com/o",
        visible: false,
      }),
    ).toEqual(ok({ status: "saved", id: github, isNew: false }));
    expect(await links.list()).toMatchObject(
      ok([{ kind: "github", url: "https://github.com/o", visible: false }]),
    );
    // Another kind for this row: as if it were gone.
    expect(await links.update(github, EMAIL)).toEqual(
      ok({ status: "not_found" }),
    );
  });

  it("orders the links as given", async () => {
    const links = createSocialLinksAdminRepository(testDb.db);
    const github = await created(GITHUB);
    const email = await created(EMAIL);

    await links.reorder([email, github]);

    expect(await links.ids()).toEqual(ok([email, github]));
  });
});
