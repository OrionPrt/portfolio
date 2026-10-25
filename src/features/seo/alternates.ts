import type { Metadata } from "next";

import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locales";
import { getPathname } from "@/i18n/navigation";

export type LocalizedHref = Parameters<typeof getPathname>[0]["href"];

/**
 * Canonical URL and hreflang links of a page, relative to `metadataBase`:
 * each language's own (translated) URL, French as the default.
 */
export function localizedAlternates(
  locale: Locale,
  href: LocalizedHref,
): NonNullable<Metadata["alternates"]> {
  const languages = Object.fromEntries(
    LOCALES.map((candidate) => [
      candidate,
      getPathname({ locale: candidate, href }),
    ]),
  ) as Record<Locale, string>;
  return {
    canonical: languages[locale],
    languages: { ...languages, "x-default": languages[DEFAULT_LOCALE] },
  };
}
