import { useLocale, useTranslations } from "next-intl";

/** First focusable element: lets keyboard users jump past the header. */
export function SkipLink() {
  const t = useTranslations("Layout");
  // Matches the locale-scoped id of <main>: the other locale's copy may still be mounted.
  const locale = useLocale();

  return (
    <a
      href={`#main-${locale}`}
      className="bg-fg text-ground rounded-control sr-only z-50 px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
    >
      {t("skipLink")}
    </a>
  );
}
