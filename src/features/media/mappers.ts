import { pickTranslation } from "@/db/query";
import type { media, mediaTranslations } from "@/db/schema";
import { LOCALES, type Locale } from "@/i18n/locales";

import type { MediaView } from "./types";

/** What a relational read loads of an entry's image: the row and its texts. */
export const WITH_MEDIA = {
  with: { translations: { limit: LOCALES.length } },
} as const;

export type MediaRow = typeof media.$inferSelect & {
  readonly translations: readonly (typeof mediaTranslations.$inferSelect)[];
};

/** An image as a page shows it: its text in the page's language, else the other. */
export function toMediaView(
  row: MediaRow | null | undefined,
  locale: Locale,
): MediaView | undefined {
  if (row === null || row === undefined) {
    return undefined;
  }
  return {
    alt: pickTranslation(row.translations, locale)?.value.alt ?? "",
    width: row.width,
    height: row.height,
    variants: row.variants,
  };
}
