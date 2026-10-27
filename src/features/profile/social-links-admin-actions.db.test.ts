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
  createSocialLinkAction,
  deleteSocialLinkAction,
  moveSocialLinkAction,
  updateSocialLinkAction,
} from "./social-links-admin-actions";

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

async function links() {
  return testDb.query<{
    id: string;
    kind: string;
    url: string;
    visible: boolean;
  }>("select id, kind, url, visible from social_links order by sort_order");
}

async function added(fields: Record<string, string>): Promise<string> {
  await expect(
    createSocialLinkAction(CONTENT_IDLE, form(fields)),
  ).rejects.toThrow("redirect:/admin/links");
  const found = (await links()).find((link) => link.kind === fields.kind);
  if (found === undefined) {
    throw new Error("Not added");
  }
  return found.id;
}

describe("social link actions", () => {
  it("add a link, audited, and expire the profile's cache (links are read with it)", async () => {
    await added({
      kind: "github",
      url: "https://github.com/orion",
      visible: "on",
    });

    expect(await links()).toMatchObject([
      { kind: "github", url: "https://github.com/orion", visible: true },
    ]);
    expect(mocks.updateTag).toHaveBeenCalledWith("profile");
  });

  it.each([
    [{ kind: "github", url: "javascript:alert(1)" }],
    [{ kind: "github", url: "mailto:orion@example.com" }],
    [{ kind: "email", url: "https://example.com" }],
    [{ kind: "nope", url: "https://example.com" }],
  ])("refuse %j, writing nothing", async (fields) => {
    expect(
      await createSocialLinkAction(CONTENT_IDLE, form(fields)),
    ).toMatchObject({
      status: "invalid",
    });
    expect(await links()).toEqual([]);
  });

  it("refuse a second link of a kind", async () => {
    await added({ kind: "github", url: "https://github.com/orion" });

    expect(
      await createSocialLinkAction(
        CONTENT_IDLE,
        form({ kind: "github", url: "https://github.com/other" }),
      ),
    ).toEqual({ status: "invalid", problems: { kind: { problem: "taken" } } });
  });

  it("update a link, hide it, and keep its kind", async () => {
    const id = await added({
      kind: "email",
      url: "mailto:orion@example.com",
      visible: "on",
    });

    expect(
      await updateSocialLinkAction(
        CONTENT_IDLE,
        form({ id, kind: "email", url: "mailto:contact@example.com" }),
      ),
    ).toMatchObject({ status: "saved" });
    expect(await links()).toMatchObject([
      { url: "mailto:contact@example.com", visible: false },
    ]);
  });

  it("move and delete links, audited", async () => {
    const github = await added({
      kind: "github",
      url: "https://github.com/orion",
    });
    const email = await added({
      kind: "email",
      url: "mailto:orion@example.com",
    });

    expect(
      await moveSocialLinkAction(
        LIST_IDLE,
        form({ id: email, direction: "up" }),
      ),
    ).toEqual({ status: "done" });
    expect((await links()).map((link) => link.id)).toEqual([email, github]);
    expect(
      await deleteSocialLinkAction(LIST_IDLE, form({ id: github })),
    ).toEqual({
      status: "done",
    });
    expect((await links()).map((link) => link.id)).toEqual([email]);
    expect(
      await testDb.query(
        "select action from audit_logs where entity = 'social_link' order by id",
      ),
    ).toEqual([
      { action: "content.created" },
      { action: "content.created" },
      { action: "content.reordered" },
      { action: "content.deleted" },
    ]);
  });
});
