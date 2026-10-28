import { readFile } from "node:fs/promises";

import { parseServerEnv } from "@/lib/env";
import {
  DISK_MEDIA_ROOT,
  DISK_MEDIA_ROUTE,
  diskPathOf,
  selectMediaStorage,
} from "@/features/media/storage";

const NOT_FOUND = () =>
  new Response(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });

/**
 * An image stored on the local disk (development and E2E). With Blob in
 * production, images are served from Blob's own domain: this answers 404.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/media/[...path]">,
): Promise<Response> {
  const storage = selectMediaStorage(parseServerEnv(process.env));
  if (storage?.kind !== "disk") {
    return NOT_FOUND();
  }
  const { path } = await params;
  const file = diskPathOf(
    DISK_MEDIA_ROOT,
    `${DISK_MEDIA_ROUTE}${path.join("/")}`,
  );
  if (file === undefined) {
    return NOT_FOUND();
  }
  try {
    return new Response(new Uint8Array(await readFile(file)), {
      headers: {
        "Content-Type": "image/webp",
        // A stored image never changes: a new upload gets a new id.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NOT_FOUND();
  }
}
