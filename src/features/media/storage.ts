import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { del, put } from "@vercel/blob";

import { allowsDevelopmentSecrets } from "@/lib/deployment";
import type { ServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/** Where the images live: Vercel Blob in production, the local disk otherwise. */
export interface MediaStorage {
  readonly kind: "blob" | "disk";
  /** Stores a public file at this path, for good; its URL. */
  readonly put: (
    pathname: string,
    body: Buffer,
    contentType: string,
  ) => Promise<string>;
  /** Removes these files; one already gone is no error. */
  readonly remove: (urls: readonly string[]) => Promise<void>;
}

/** A stored image never changes: a new upload is a new image, under a new id. */
const ONE_YEAR_S = 31_536_000;

/** Where the disk storage serves its files (src/app/api/media). */
export const DISK_MEDIA_ROUTE = "/api/media/";

/** The only files the disk storage writes, reads or removes. */
const MEDIA_FILE = /^media\/[0-9a-f-]{36}\/\d{1,4}\.webp$/;

/** One stored width of an image: "media/<id>/960.webp". */
export function mediaPathname(id: string, width: number): string {
  return `media/${id}/${String(width)}.webp`;
}

/** The file behind a disk storage URL, or undefined for anything else. */
export function diskPathOf(root: string, url: string): string | undefined {
  if (!url.startsWith(DISK_MEDIA_ROUTE)) {
    return undefined;
  }
  const pathname = url.slice(DISK_MEDIA_ROUTE.length);
  return MEDIA_FILE.test(pathname) ? path.join(root, pathname) : undefined;
}

/** Development and E2E: files under `root`, served by a route of the app. */
export function createDiskStorage(root: string): MediaStorage {
  return {
    kind: "disk",
    put: async (pathname, body) => {
      const file = diskPathOf(root, `${DISK_MEDIA_ROUTE}${pathname}`);
      if (file === undefined) {
        throw new Error("Not a media pathname");
      }
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
      return `${DISK_MEDIA_ROUTE}${pathname}`;
    },
    remove: async (urls) => {
      const files = urls.flatMap((url) => diskPathOf(root, url) ?? []);
      await Promise.all(files.map((file) => rm(file, { force: true })));
    },
  };
}

/** Production: public files on Vercel Blob's own domain, apart from the site. */
export function createBlobStorage(token: string): MediaStorage {
  return {
    kind: "blob",
    put: async (pathname, body, contentType) => {
      const stored = await put(pathname, body, {
        access: "public",
        addRandomSuffix: false,
        contentType,
        cacheControlMaxAge: ONE_YEAR_S,
        token,
      });
      return stored.url;
    },
    remove: async (urls) => {
      await del([...urls], { token });
    },
  };
}

/** The disk storage's folder: gitignored, next to the app. */
export const DISK_MEDIA_ROOT = path.join(process.cwd(), ".media");

/**
 * Blob when its token is set; the local disk where development defaults are
 * allowed (development, tests, the E2E server); none otherwise, so a
 * production build never writes to a disk that may not last, on Vercel or not.
 */
export function selectMediaStorage(
  env: Pick<
    ServerEnv,
    | "BLOB_READ_WRITE_TOKEN"
    | "VERCEL_ENV"
    | "NODE_ENV"
    | "ALLOW_DEVELOPMENT_SECRETS"
  >,
): MediaStorage | undefined {
  if (env.BLOB_READ_WRITE_TOKEN !== undefined) {
    return createBlobStorage(env.BLOB_READ_WRITE_TOKEN);
  }
  return allowsDevelopmentSecrets(env)
    ? createDiskStorage(DISK_MEDIA_ROOT)
    : undefined;
}

/** Files left behind are logged, not fatal: the library's record is what counts. */
export async function removeQuietly(
  storage: MediaStorage,
  urls: readonly string[],
): Promise<void> {
  try {
    await storage.remove(urls);
  } catch (error) {
    logger.error("media.cleanup_failed", { error });
  }
}
