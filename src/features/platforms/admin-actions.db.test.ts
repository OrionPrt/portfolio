import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { CONTENT_IDLE, LIST_IDLE } from "@/features/admin/content-form-state";
import { siteToday } from "@/lib/dates";
import { ok } from "@/lib/result";

import { createAdmin } from "../../../test/auth";
import { createTestDatabase, type TestDatabase } from "../../../test/db";

let testDb: TestDatabase;

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  checkedRequest: vi.fn(),
  updateTag: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/features/auth/dal", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/features/auth/checked-request", () => ({
  checkedRequest: mocks.checkedRequest,
}));
vi.mock("@/db/client", () => ({
  withDatabase: (run: (db: unknown) => unknown) => run(testDb.db),
}));
vi.mock("next/cache", () => ({
  updateTag: mocks.updateTag,
  refresh: mocks.refresh,
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

import {
  createPlatformAction,
  deletePlatformAction,
  movePlatformAction,
  updatePlatformAction,
} from "./admin-actions";

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  vi.clearAllMocks();
  const admin = await createAdmin(testDb.db);
  mocks.requireAdmin.mockResolvedValue({
    sessionId: "a".repeat(64),
    stage: "signed_in",
    expiresAt: new Date(),
    user: { id: admin.id, email: admin.email },
  });
  mocks.checkedRequest.mockResolvedValue(
    ok({
      config: {},
      context: { networkHash: "c".repeat(64), userAgent: null },
    }),
  );
});

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.append(name, value);
  }
  return data;
}

async function listed() {
  return testDb.query<{
    id: string;
    name: string;
    profile_url: string | null;
    rank: string | null;
    points: number | null;
    updated_on: string;
  }>(
    "select id, name, profile_url, rank, points, updated_on::text from platforms order by sort_order",
  );
}

async function added(fields: Record<string, string>): Promise<string> {
  await expect(
    createPlatformAction(CONTENT_IDLE, form(fields)),
  ).rejects.toThrow("redirect:/admin/platforms");
  const found = (await listed()).find((row) => row.name === fields.name);
  if (found === undefined) {
    throw new Error("Not added");
  }
  return found.id;
}

describe("platform actions", () => {
  it("add a platform read today, its points as typed, and expire the platforms' cache", async () => {
    await added({
      name: "Hack The Box",
      profileUrl: "https://app.hackthebox.com/profile/1",
      rank: "Pro Hacker",
      points: "12 500",
      updatedOn: "",
    });

    expect(await listed()).toMatchObject([
      {
        name: "Hack The Box",
        rank: "Pro Hacker",
        points: 12_500,
        updated_on: siteToday(),
      },
    ]);
    expect(mocks.updateTag).toHaveBeenCalledWith("platforms");
  });

  it.each([
    [{ name: "HTB", profileUrl: "javascript:alert(1)" }, "profileUrl"],
    [{ name: "HTB", points: "douze" }, "points"],
    [{ name: "HTB", points: "-3" }, "points"],
    [{ name: "", points: "3" }, "name"],
  ])("refuse %j on its field, writing nothing", async (fields, field) => {
    const outcome = await createPlatformAction(CONTENT_IDLE, form(fields));

    expect(outcome).toMatchObject({ status: "invalid" });
    expect(Object.keys("problems" in outcome ? outcome.problems : {})).toEqual([
      field,
    ]);
    expect(await listed()).toEqual([]);
  });

  it("update a platform, emptying what it no longer shows", async () => {
    const id = await added({ name: "Root Me", rank: "Hacker", points: "3165" });

    expect(
      await updatePlatformAction(
        CONTENT_IDLE,
        form({ id, name: "Root Me", points: "3200", updatedOn: "2026-10-01" }),
      ),
    ).toEqual({ status: "saved" });
    expect(await listed()).toMatchObject([
      { rank: null, points: 3200, updated_on: "2026-10-01" },
    ]);
  });

  it("move and delete platforms, audited", async () => {
    const htb = await added({ name: "Hack The Box" });
    const rootMe = await added({ name: "Root Me" });

    expect(
      await movePlatformAction(
        LIST_IDLE,
        form({ id: rootMe, direction: "up" }),
      ),
    ).toEqual({ status: "done" });
    expect((await listed()).map((row) => row.id)).toEqual([rootMe, htb]);
    expect(await deletePlatformAction(LIST_IDLE, form({ id: htb }))).toEqual({
      status: "done",
    });
    expect((await listed()).map((row) => row.id)).toEqual([rootMe]);
    expect(
      await testDb.query(
        "select action from audit_logs where entity = 'platform' order by id",
      ),
    ).toEqual([
      { action: "content.created" },
      { action: "content.created" },
      { action: "content.reordered" },
      { action: "content.deleted" },
    ]);
  });
});
