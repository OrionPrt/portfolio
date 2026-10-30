import { asc } from "drizzle-orm";

import { MAX_PLATFORMS } from "@/db/limits";
import { runQuery } from "@/db/query";
import { platforms } from "@/db/schema";
import type { Database } from "@/db/types";
import type { Result } from "@/lib/result";

/** A platform as the site shows it: entered by hand, never fetched (ADR-0009). */
export interface PlatformView {
  readonly name: string;
  readonly profileUrl: string | null;
  readonly rank: string | null;
  readonly points: number | null;
  /** The day its rank and points were read. */
  readonly updatedOn: string;
}

export function createPlatformsRepository(db: Database) {
  return {
    list: (): Promise<Result<readonly PlatformView[]>> =>
      runQuery("platforms.read_failed", () =>
        db
          .select({
            name: platforms.name,
            profileUrl: platforms.profileUrl,
            rank: platforms.rank,
            points: platforms.points,
            updatedOn: platforms.updatedOn,
          })
          .from(platforms)
          .orderBy(asc(platforms.sortOrder), asc(platforms.name))
          .limit(MAX_PLATFORMS),
      ),
  };
}
