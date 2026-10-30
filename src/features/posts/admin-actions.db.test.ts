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
  createPostAction,
  deletePostAction,
  updatePostAction,
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

const ENGLISH = {
  slug: "a-box",
  kind: "article",
  status: "draft",
  "en.title": "Pwning a box",
  "en.excerpt": "How it fell.",
  "en.bodyMd": "## Recon\n\nNmap first.",
};

/** Created, its id from the redirect to its page. */
async function created(entries: Record<string, string>): Promise<string> {
  const outcome = createPostAction(CONTENT_IDLE, form(entries));
  const error = await outcome.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  const match = /redirect:\/admin\/posts\/([0-9a-f-]{36})$/.exec(
    error instanceof Error ? error.message : "",
  );
  if (match?.[1] === undefined) {
    throw new Error(`Not created: ${String(error)}`);
  }
  return match[1];
}

describe("post actions", () => {
  it("refuse anyone without a full session", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("redirect:/admin/login"));

    await expect(createPostAction(CONTENT_IDLE, form(ENGLISH))).rejects.toThrow(
      "redirect:/admin/login",
    );
    expect(await testDb.query("select id from posts")).toEqual([]);
  });

  it("create a post in English only, audit it and expire the posts' cache", async () => {
    const id = await created(ENGLISH);

    expect(
      await testDb.query("select locale, title from post_translations"),
    ).toEqual([{ locale: "en", title: "Pwning a box" }]);
    expect(
      await testDb.query("select action, entity, entity_id from audit_logs"),
    ).toEqual([{ action: "content.created", entity: "post", entity_id: id }]);
    expect(mocks.updateTag).toHaveBeenCalledWith("posts");
    expect(mocks.updateTag).toHaveBeenCalledWith("post:a-box");
  });

  it("refuse a post written in no language, under one name", async () => {
    expect(
      await createPostAction(
        CONTENT_IDLE,
        form({ slug: "empty", kind: "article", status: "draft" }),
      ),
    ).toEqual({
      status: "invalid",
      problems: { language: { problem: "required" } },
    });
  });

  it("publish a post without a day on today's", async () => {
    const id = await created({ ...ENGLISH, status: "published" });

    expect(
      await testDb.query(
        `select published_on::text as day from posts where id = '${id}'`,
      ),
    ).toEqual([{ day: siteToday() }]);
  });

  it("keep a live challenge's write-up unpublished, on its retirement field", async () => {
    const writeup = {
      ...ENGLISH,
      kind: "writeup",
      platform: "hackthebox",
      status: "published",
    };

    expect(await createPostAction(CONTENT_IDLE, form(writeup))).toEqual({
      status: "invalid",
      problems: { retiredOn: { problem: "invalid" } },
    });
    await created({ ...writeup, retiredOn: "2026-09-01" });
  });

  it("rename a published post, leaving a redirect from its old slug", async () => {
    const id = await created({ ...ENGLISH, status: "published" });

    expect(
      await updatePostAction(
        CONTENT_IDLE,
        form({ ...ENGLISH, id, status: "published", slug: "a-box-renamed" }),
      ),
    ).toEqual({ status: "saved" });

    expect(
      await testDb.query(
        "select collection, from_slug, to_slug from slug_redirects",
      ),
    ).toEqual([
      { collection: "posts", from_slug: "a-box", to_slug: "a-box-renamed" },
    ]);
    expect(mocks.updateTag).toHaveBeenCalledWith("post:a-box");
  });

  it("delete a post with a snapshot of it and its languages, and its redirects", async () => {
    const id = await created({ ...ENGLISH, status: "published" });
    await updatePostAction(
      CONTENT_IDLE,
      form({ ...ENGLISH, id, status: "published", slug: "a-box-renamed" }),
    );

    expect(await deletePostAction(LIST_IDLE, form({ id }))).toEqual({
      status: "done",
    });

    expect(await testDb.query("select id from posts")).toEqual([]);
    expect(await testDb.query("select id from slug_redirects")).toEqual([]);
    const [snapshot] = await testDb.query<{ diff: { row: { slug: string } } }>(
      "select diff from audit_logs where action = 'content.deleted'",
    );
    expect(snapshot?.diff.row.slug).toBe("a-box-renamed");
  });
});
