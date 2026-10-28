import "server-only";

import type { Database } from "@/db/types";
import type { Result } from "@/lib/result";

import { createMediaAdminRepository } from "./admin-repository";
import type { MediaOption } from "./types";

/** The library, latest first, for the forms that pick an image. */
export function loadMediaOptions(
  db: Database,
): Promise<Result<readonly MediaOption[]>> {
  return createMediaAdminRepository(db).options();
}
