import type { MetadataRoute } from "next";

import type { PublishedSlugs } from "@/features/content/slug-registry";
import { DEFAULT_LOCALE, LOCALES } from "@/i18n/locales";
import { getPathname } from "@/i18n/navigation";

import type { LocalizedHref } from "./alternates";

const STATIC_PAGES: readonly LocalizedHref[] = [
  "/",
  "/about",
  "/skills",
  "/projects",
  "/experiences",
  "/contact",
];

function entry(base: URL, href: LocalizedHref): MetadataRoute.Sitemap[number] {
  const urlFor = (locale: (typeof LOCALES)[number]) =>
    new URL(getPathname({ locale, href }), base).href;
  return {
    url: urlFor(DEFAULT_LOCALE),
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((locale) => [locale, urlFor(locale)]),
      ),
    },
  };
}

/**
 * Every public page and published entry, with its translations. No
 * `lastModified`: updated_at means "last written", and a re-seed bumps it.
 */
export function sitemapEntries(
  base: URL,
  slugs: PublishedSlugs,
): MetadataRoute.Sitemap {
  return [
    ...STATIC_PAGES.map((href) => entry(base, href)),
    ...slugs.projects.map((slug) =>
      entry(base, { pathname: "/projects/[slug]", params: { slug } }),
    ),
    ...slugs.experiences.map((slug) =>
      entry(base, { pathname: "/experiences/[slug]", params: { slug } }),
    ),
  ];
}
