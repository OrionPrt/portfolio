import { inArray } from "drizzle-orm";

import { runQuery } from "@/db/query";
import { media } from "@/db/schema";
import type { Database } from "@/db/types";
import { LOCALES, type Locale } from "@/i18n/locales";
import type { Result } from "@/lib/result";

import { toMediaView } from "./mappers";
import { MAX_IMAGES_PER_TEXT } from "./references";
import type { MediaById } from "./types";

/** The library as the public pages read it. */
export function createMediaRepository(db: Database) {
  return {
    /** The images these ids name, as a page shows them; an id the library lost is left out. */
    findByIds: (
      ids: readonly string[],
      locale: Locale,
    ): Promise<Result<MediaById>> =>
      runQuery("media.read_failed", async () => {
        if (ids.length === 0) {
          return {};
        }
        const rows = await db.query.media.findMany({
          where: inArray(media.id, ids.slice(0, MAX_IMAGES_PER_TEXT)),
          limit: MAX_IMAGES_PER_TEXT,
          with: { translations: { limit: LOCALES.length } },
        });
        return Object.fromEntries(
          rows.flatMap((row) => {
            const view = toMediaView(row, locale);
            return view === undefined ? [] : [[row.id, view] as const];
          }),
        );
      }),
  };
}
