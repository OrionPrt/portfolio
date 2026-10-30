import { defineRouting } from "next-intl/routing";

import { DEFAULT_LOCALE, LOCALES } from "./locales";

export type { Locale } from "./locales";

/**
 * Internal routes are English folders under app/[locale]; `pathnames` maps
 * them to the URL shown in each language. It is also the list of known routes:
 * the proxy answers 404 for anything else (src/i18n/route-match.ts).
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
  // Remembers the language for a year. Not HttpOnly: next-intl's Link updates it client-side.
  localeCookie: { maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: true },
  // hreflang comes from page metadata (P3) and NEXT_PUBLIC_SITE_URL, never from request headers.
  alternateLinks: false,
  pathnames: {
    "/": "/",
    "/about": { fr: "/a-propos", en: "/about" },
    "/skills": { fr: "/competences", en: "/skills" },
    "/projects": { fr: "/projets", en: "/projects" },
    "/projects/[slug]": { fr: "/projets/[slug]", en: "/projects/[slug]" },
    "/experiences": { fr: "/experiences", en: "/experiences" },
    "/experiences/[slug]": {
      fr: "/experiences/[slug]",
      en: "/experiences/[slug]",
    },
    // Articles and write-ups: one word in both languages.
    "/posts": "/blog",
    "/posts/[slug]": "/blog/[slug]",
    "/contact": "/contact",
  },
});
