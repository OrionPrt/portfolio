import { defineRouting } from "next-intl/routing";

/**
 * Internal routes are English folders under app/[locale]; `pathnames` maps
 * them to the URL shown in each language. P3 adds the remaining pages.
 */
export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "always",
  // Remembers the language for a year. Not HttpOnly: next-intl's Link updates it client-side.
  localeCookie: { maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: true },
  // hreflang comes from page metadata (P3) and NEXT_PUBLIC_SITE_URL, never from request headers.
  alternateLinks: false,
  pathnames: {
    "/": "/",
    "/projects/[slug]": {
      fr: "/projets/[slug]",
      en: "/projects/[slug]",
    },
  },
});

export type Locale = (typeof routing.locales)[number];
