import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  afterEach,
  it,
  vi,
} from "vitest";

import { CONTENT_IDLE, LIST_IDLE } from "@/features/admin/content-form-state";
import type * as Storage from "@/features/media/storage";
import { ok } from "@/lib/result";

import { createAdmin } from "../../../test/auth";
import { createTestDatabase, type TestDatabase } from "../../../test/db";

let testDb: TestDatabase;
const root = vi.hoisted(() => ({ dir: "" }));

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
vi.mock("@/features/media/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof Storage>();
  return {
    ...actual,
    selectMediaStorage: () => actual.createDiskStorage(root.dir),
  };
});
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

import { deleteMediaAction, updateMediaAltAction } from "./admin-actions";

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

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const FILE = `media/${ID}/480.webp`;

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.append(name, value);
  }
  return data;
}

/** An image in the library, its one file on the disk storage. */
async function stored(): Promise<void> {
  root.dir = await mkdtemp(path.join(tmpdir(), "media-actions-"));
  await mkdir(path.join(root.dir, "media", ID), { recursive: true });
  await writeFile(path.join(root.dir, FILE), "webp");
  await testDb.exec(
    `insert into media (id, sha256, pathname, width, height, variants)
     values ('${ID}', '${"a".repeat(64)}', 'media/${ID}', 480, 270,
       '[{"width":480,"height":270,"url":"/api/media/${FILE}","bytes":4}]');
     insert into media_translations (media_id, locale, alt)
     values ('${ID}', 'fr', 'Capture'), ('${ID}', 'en', 'Screenshot')`,
  );
}

async function files(): Promise<string[]> {
  return (await readdir(root.dir, { recursive: true })).filter((file) =>
    file.endsWith(".webp"),
  );
}

describe("media actions", () => {
  afterEach(async () => {
    await rm(root.dir, { recursive: true, force: true });
  });

  it("change both alternative texts, and expire every read showing an image", async () => {
    await stored();

    expect(
      await updateMediaAltAction(
        CONTENT_IDLE,
        form({ id: ID, "alt.fr": "Tableau", "alt.en": "Board" }),
      ),
    ).toEqual({ status: "saved" });
    expect(
      await testDb.query("select alt from media_translations order by locale"),
    ).toEqual([{ alt: "Tableau" }, { alt: "Board" }]);
    expect(mocks.updateTag).toHaveBeenCalledWith("media");
    expect(
      await updateMediaAltAction(
        CONTENT_IDLE,
        form({ id: ID, "alt.fr": "", "alt.en": "Board" }),
      ),
    ).toEqual({
      status: "invalid",
      problems: { "alt.fr": { problem: "required" } },
    });
  });

  it("keep an image an entry shows, then delete it with its files once none does", async () => {
    await stored();
    await testDb.exec(
      `insert into projects (slug, domain, cover_media_id) values ('demo', 'web', '${ID}')`,
    );

    expect(await deleteMediaAction(LIST_IDLE, form({ id: ID }))).toEqual({
      status: "in_use",
    });
    expect(await files()).toHaveLength(1);

    await testDb.exec("update projects set cover_media_id = null");
    expect(await deleteMediaAction(LIST_IDLE, form({ id: ID }))).toEqual({
      status: "done",
    });
    expect(await files()).toEqual([]);
    const [entry] = await testDb.query<{
      diff: { row: { pathname: string }; translations: { alt: string }[] };
    }>("select diff from audit_logs where action = 'content.deleted'");
    expect(entry?.diff.row.pathname).toBe(`media/${ID}`);
    expect(entry?.diff.translations).toHaveLength(2);
    expect(await deleteMediaAction(LIST_IDLE, form({ id: ID }))).toEqual({
      status: "not_found",
    });
  });
});
