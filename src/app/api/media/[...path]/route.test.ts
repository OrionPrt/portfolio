import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type * as Storage from "@/features/media/storage";

const root = vi.hoisted(() => ({ dir: "" }));
vi.mock("@/features/media/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof Storage>();
  return {
    ...actual,
    get DISK_MEDIA_ROOT() {
      return root.dir;
    },
    selectMediaStorage: (
      env: Parameters<typeof actual.selectMediaStorage>[0],
    ) =>
      actual.selectMediaStorage(env)?.kind === "disk"
        ? actual.createDiskStorage(root.dir)
        : actual.selectMediaStorage(env),
  };
});

import { GET } from "./route";

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

function get(segments: readonly string[]) {
  return GET(new Request("http://localhost/api/media"), {
    params: Promise.resolve({ path: [...segments] }),
  });
}

beforeAll(async () => {
  root.dir = await mkdtemp(path.join(tmpdir(), "media-route-"));
  await mkdir(path.join(root.dir, "media", ID), { recursive: true });
  await writeFile(path.join(root.dir, "media", ID, "480.webp"), "webp");
});

afterAll(async () => {
  await rm(root.dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("GET /api/media/[...path]", () => {
  it("serves a stored image as WebP, cached for good, never sniffed", async () => {
    const response = await get(["media", ID, "480.webp"]);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("webp");
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it.each([
    [["media", ID, "960.webp"]],
    [["media", "..", "..", "etc", "passwd"]],
    [["media", ID, "480.png"]],
  ])("answers 404 for %j", async (segments) => {
    expect((await get(segments)).status).toBe(404);
  });

  it("answers 404 on Vercel, where images live on Blob", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

    expect((await get(["media", ID, "480.webp"])).status).toBe(404);
    vi.unstubAllEnvs();
  });
});
