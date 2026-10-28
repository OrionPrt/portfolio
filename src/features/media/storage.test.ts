import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blob = vi.hoisted(() => ({ put: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => blob);

import {
  createBlobStorage,
  createDiskStorage,
  diskPathOf,
  mediaPathname,
  selectMediaStorage,
} from "./storage";

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("mediaPathname", () => {
  it("names each stored width under the image's own prefix", () => {
    expect(mediaPathname(ID, 960)).toBe(`media/${ID}/960.webp`);
  });
});

describe("disk storage", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "media-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes a file it serves itself, then removes it, twice harmlessly", async () => {
    const storage = createDiskStorage(root);
    const pathname = mediaPathname(ID, 480);

    const url = await storage.put(pathname, Buffer.from("webp"), "image/webp");

    expect(url).toBe(`/api/media/${pathname}`);
    expect(await readFile(path.join(root, pathname), "utf8")).toBe("webp");
    await storage.remove([url]);
    await storage.remove([url]);
    await expect(readFile(path.join(root, pathname))).rejects.toThrow();
  });

  it.each([
    "/api/media/media/../../etc/passwd",
    "/api/media/media/not-an-id/480.webp",
    `/api/media/media/${ID}/480.png`,
    "https://elsewhere.example/media/x.webp",
  ])("never maps %j to a file", (url) => {
    expect(diskPathOf(root, url)).toBeUndefined();
  });
});

describe("Blob storage", () => {
  it("stores public, immutable files at the path given, with the token", async () => {
    blob.put.mockResolvedValue({
      url: "https://s.public.blob.vercel-storage.com/x",
    });
    const storage = createBlobStorage("vercel_blob_rw_token");

    expect(
      await storage.put(mediaPathname(ID, 480), Buffer.from("w"), "image/webp"),
    ).toBe("https://s.public.blob.vercel-storage.com/x");
    expect(blob.put).toHaveBeenCalledWith(
      `media/${ID}/480.webp`,
      Buffer.from("w"),
      expect.objectContaining({
        access: "public",
        addRandomSuffix: false,
        contentType: "image/webp",
        cacheControlMaxAge: 31_536_000,
        token: "vercel_blob_rw_token",
      }),
    );

    await storage.remove(["https://s.public.blob.vercel-storage.com/x"]);
    expect(blob.del).toHaveBeenCalledWith(
      ["https://s.public.blob.vercel-storage.com/x"],
      { token: "vercel_blob_rw_token" },
    );
  });
});

describe("selectMediaStorage", () => {
  const BASE = {
    BLOB_READ_WRITE_TOKEN: undefined,
    VERCEL_ENV: undefined,
    NODE_ENV: "development",
    ALLOW_DEVELOPMENT_SECRETS: undefined,
  } as const;

  it.each([
    [{ BLOB_READ_WRITE_TOKEN: "t", VERCEL_ENV: "production" }, "blob"],
    [{}, "disk"],
    [{ VERCEL_ENV: "development" }, "disk"],
    // The E2E server: a production build allowed development defaults.
    [{ NODE_ENV: "production", ALLOW_DEVELOPMENT_SECRETS: "true" }, "disk"],
    [{ VERCEL_ENV: "preview" }, undefined],
    [{ VERCEL_ENV: "production" }, undefined],
    // A production build hosted elsewhere, without Blob: no ephemeral disk either.
    [{ NODE_ENV: "production" }, undefined],
  ] as const)("picks for %j: %s", (overrides, kind) => {
    expect(selectMediaStorage({ ...BASE, ...overrides })?.kind).toBe(kind);
  });
});
