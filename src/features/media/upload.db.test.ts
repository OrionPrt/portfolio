import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { MAX_MEDIA } from "@/db/limits";
import { MAX_UPLOAD_BYTES } from "@/features/media/image-processing";
import { ok } from "@/lib/result";

import { createAdmin } from "../../../test/auth";
import { createTestDatabase, type TestDatabase } from "../../../test/db";

let testDb: TestDatabase;

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  requireAdmin: vi.fn(),
  checkedRequest: vi.fn(),
}));

vi.mock("@/features/auth/dal", () => ({
  getAdminSession: mocks.getAdminSession,
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/features/auth/checked-request", () => ({
  checkedRequest: mocks.checkedRequest,
}));
vi.mock("@/db/client", () => ({
  withDatabase: (run: (db: unknown) => unknown) => run(testDb.db),
}));

import { createDiskStorage, type MediaStorage } from "./storage";
import { uploadMedia } from "./upload";

let root: string;
let storage: MediaStorage;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  vi.clearAllMocks();
  root = await mkdtemp(path.join(tmpdir(), "upload-"));
  storage = createDiskStorage(root);
  const admin = await createAdmin(testDb.db);
  mocks.getAdminSession.mockResolvedValue({
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

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function png(width: number, height: number, red = 200): Promise<Blob> {
  const bytes = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: red, g: 80, b: 40 },
    },
  })
    .png()
    .toBuffer();
  return new Blob([new Uint8Array(bytes)], { type: "image/png" });
}

function upload(
  file: Blob | undefined,
  alt: { fr?: string; en?: string } = { fr: "Capture", en: "Screenshot" },
) {
  const data = new FormData();
  if (file !== undefined) {
    data.append("file", file, "capture.png");
  }
  data.append("alt.fr", alt.fr ?? "");
  data.append("alt.en", alt.en ?? "");
  return uploadMedia(
    new Request("http://localhost/api/admin/media", {
      method: "POST",
      body: data,
    }),
    storage,
  );
}

async function storedFiles(): Promise<string[]> {
  const files = await readdir(root, { recursive: true });
  return files.filter((file) => file.endsWith(".webp")).sort();
}

describe("uploadMedia", () => {
  it("stores each width, records the image and its texts, and audits it", async () => {
    const outcome = await upload(await png(1200, 600));
    if (outcome.status !== "saved") {
      throw new Error(outcome.status);
    }

    expect(await storedFiles()).toEqual(
      ["480.webp", "960.webp", "1200.webp"]
        .map((file) => path.join("media", outcome.id, file))
        .sort(),
    );
    expect(
      await testDb.query("select width, height, pathname from media"),
    ).toEqual([{ width: 1200, height: 600, pathname: `media/${outcome.id}` }]);
    expect(
      await testDb.query(
        "select locale, alt from media_translations order by locale",
      ),
    ).toEqual([
      // An enum sorts in its declared order.
      { locale: "fr", alt: "Capture" },
      { locale: "en", alt: "Screenshot" },
    ]);
    expect(
      await testDb.query("select action, entity, entity_id from audit_logs"),
    ).toEqual([
      { action: "content.created", entity: "media", entity_id: outcome.id },
    ]);
  });

  it("refuses no session before reading anything", async () => {
    mocks.getAdminSession.mockResolvedValue(undefined);

    expect(await upload(await png(10, 10))).toEqual({ status: "signed_out" });
    expect(await storedFiles()).toEqual([]);
  });

  it("names each field in fault: no file, no texts", async () => {
    expect(await upload(undefined, {})).toEqual({
      status: "invalid",
      problems: {
        file: { problem: "required" },
        "alt.fr": { problem: "required" },
        "alt.en": { problem: "required" },
      },
    });
  });

  it("refuses a file that is no image it takes, and the same image twice", async () => {
    expect(
      await upload(new Blob(["<svg xmlns='http://www.w3.org/2000/svg'/>"])),
    ).toEqual({
      status: "invalid",
      problems: { file: { problem: "invalid" } },
    });

    const image = await png(100, 100);
    await upload(image);
    expect(await upload(image)).toEqual({
      status: "invalid",
      problems: { file: { problem: "taken" } },
    });
    expect(await testDb.query("select id from media")).toHaveLength(1);
  });

  it("refuses a file over the limit unread, whatever the request claimed", async () => {
    expect(
      await upload(new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)])),
    ).toEqual({
      status: "invalid",
      problems: { file: { problem: "invalid" } },
    });
  });

  it("stops where the library does", async () => {
    await testDb.exec(
      `insert into media (sha256, pathname, width, height, variants)
       select lpad(to_hex(n), 64, '0'), 'media/' || n, 1, 1, '[{"width":1,"height":1,"url":"/x","bytes":1}]'
       from generate_series(1, ${String(MAX_MEDIA)}) as n`,
    );

    expect(await upload(await png(10, 10))).toEqual({ status: "full" });
  });

  it("removes the files it stored when the record cannot be written", async () => {
    // The id drawn is already some image's storage prefix: the record is refused.
    const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
    vi.spyOn(crypto, "randomUUID").mockReturnValue(id);
    await testDb.exec(
      `insert into media (sha256, pathname, width, height, variants)
       values ('${"f".repeat(64)}', 'media/${id}', 1, 1, '[{"width":1,"height":1,"url":"/x","bytes":1}]')`,
    );

    expect(await upload(await png(100, 100))).toEqual({
      status: "unavailable",
    });
    expect(await storedFiles()).toEqual([]);
    vi.restoreAllMocks();
  });

  it("logs why the storage refused a width, and stores nothing", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const remove = vi.fn();
    storage = {
      kind: "blob",
      put: () =>
        Promise.reject(
          new Error("Vercel Blob: Cannot use public access on a private store"),
        ),
      remove,
    };

    expect((await upload(await png(1200, 600))).status).toBe("unavailable");

    const logged = consoleError.mock.calls.map((call) => String(call[0]));
    expect(
      logged.find((line) => line.includes("media.store_failed")),
    ).toContain("Cannot use public access on a private store");
    expect(logged.some((line) => line.includes("media.cleanup_failed"))).toBe(
      false,
    );
    expect(remove).not.toHaveBeenCalled();
    expect(await testDb.query("select id from media")).toEqual([]);
    consoleError.mockRestore();
  });

  it("says when no storage is configured", async () => {
    const data = new FormData();
    data.append("file", await png(10, 10), "a.png");
    data.append("alt.fr", "Capture");
    data.append("alt.en", "Screenshot");

    expect(
      await uploadMedia(
        new Request("http://localhost/api/admin/media", {
          method: "POST",
          body: data,
        }),
        undefined,
      ),
    ).toEqual({ status: "unavailable" });
  });
});
