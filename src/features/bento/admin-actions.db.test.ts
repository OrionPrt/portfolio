import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { CONTENT_IDLE } from "@/features/admin/content-form-state";
import { ok } from "@/lib/result";

import { createAdmin } from "../../../test/auth";
import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { CHECKED, LAYOUT_FIELDS, type TileSetting } from "./layout";

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

import { saveBentoLayoutAction } from "./admin-actions";

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

const LAYOUT: readonly TileSetting[] = [
  { kind: "featured_project", size: "xl", visible: true },
  { kind: "identity", size: "lg", visible: true },
  { kind: "current_experience", size: "md", visible: false },
  { kind: "stack", size: "md", visible: true },
  { kind: "cyber_stats", size: "sm", visible: true },
  { kind: "certifications", size: "sm", visible: false },
  { kind: "contact", size: "sm", visible: true },
];

/** The form the editor sends for a layout. */
function form(layout: readonly TileSetting[]): FormData {
  const data = new FormData();
  for (const tile of layout) {
    data.append(LAYOUT_FIELDS.order, tile.kind);
    data.append(LAYOUT_FIELDS.size(tile.kind), tile.size);
    if (tile.visible) {
      data.append(LAYOUT_FIELDS.visible(tile.kind), CHECKED);
    }
  }
  return data;
}

async function storedTiles() {
  return testDb.query(
    "select kind, size, visible from bento_tiles order by sort_order",
  );
}

describe("saveBentoLayoutAction", () => {
  it("refuses anyone without a full session", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("redirect:/admin/login"));

    await expect(
      saveBentoLayoutAction(CONTENT_IDLE, form(LAYOUT)),
    ).rejects.toThrow("redirect:/admin/login");
    expect(await storedTiles()).toEqual([]);
  });

  it("saves the layout, audits it and expires the hub's cache", async () => {
    expect(await saveBentoLayoutAction(CONTENT_IDLE, form(LAYOUT))).toEqual({
      status: "saved",
    });

    expect(await storedTiles()).toEqual(LAYOUT);
    expect(
      await testDb.query(
        "select action, entity, entity_id, diff from audit_logs",
      ),
    ).toEqual([
      {
        action: "content.updated",
        entity: "bento_tile",
        entity_id: "layout",
        diff: {
          tiles:
            "featured_project:xl, identity:lg, current_experience:md:hidden, stack:md, cyber_stats:sm, certifications:sm:hidden, contact:sm",
        },
      },
    ]);
    expect(mocks.updateTag).toHaveBeenCalledWith("bento");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("refuses a size the tile does not fit, or a hidden identity, on their fields", async () => {
    const data = form(LAYOUT);
    data.set(LAYOUT_FIELDS.size("contact"), "xl");
    data.delete(LAYOUT_FIELDS.visible("identity"));

    expect(await saveBentoLayoutAction(CONTENT_IDLE, data)).toEqual({
      status: "invalid",
      problems: {
        "size.contact": { problem: "invalid" },
        "visible.identity": { problem: "invalid" },
      },
    });
    expect(await storedTiles()).toEqual([]);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("refuses an order that leaves out or repeats a tile", async () => {
    const data = form(LAYOUT);
    data.delete(LAYOUT_FIELDS.order);
    for (const tile of [...LAYOUT.slice(1), LAYOUT[1]]) {
      data.append(LAYOUT_FIELDS.order, tile?.kind ?? "");
    }

    expect(await saveBentoLayoutAction(CONTENT_IDLE, data)).toMatchObject({
      status: "invalid",
      problems: { order: { problem: "invalid" } },
    });
  });

  it.each([
    [
      "a tile not built yet",
      (data: FormData) => {
        data.append(LAYOUT_FIELDS.order, "cv");
      },
    ],
    [
      "a list far longer than the tiles",
      (data: FormData) => {
        for (let index = 0; index < 1000; index += 1) {
          data.append(LAYOUT_FIELDS.order, "contact");
        }
      },
    ],
    [
      "a file for a size",
      (data: FormData) => {
        data.set(LAYOUT_FIELDS.size("contact"), new File(["sm"], "sm.txt"));
      },
    ],
  ])("refuses %s, and stores nothing", async (_case, tamper) => {
    const data = form(LAYOUT);
    tamper(data);

    expect(await saveBentoLayoutAction(CONTENT_IDLE, data)).toMatchObject({
      status: "invalid",
    });
    expect(await storedTiles()).toEqual([]);
  });
});
