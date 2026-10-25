"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/** Links to the current page in every locale, so switching keeps the visitor where they are. */
export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const currentLocale = useLocale();
  const pathname = usePathname();
  const params = useParams();

  return (
    <nav aria-label={t("label")}>
      <ul className="border-line bg-surface flex gap-0.5 rounded-[10px] border p-[3px] font-mono text-xs">
        {routing.locales.map((locale) => {
          const isCurrent = locale === currentLocale;
          return (
            <li key={locale}>
              <Link
                // @ts-expect-error -- pathname and params both come from the current route, so they always match.
                href={{ pathname, params }}
                locale={locale}
                hrefLang={locale}
                lang={locale}
                aria-current={isCurrent ? "true" : undefined}
                className={`inline-flex h-7 items-center rounded-[7px] px-2.5 ${
                  isCurrent
                    ? "bg-surface-muted text-fg ring-fg-muted font-medium ring-1 forced-colors:outline-2 forced-colors:outline-solid"
                    : "text-fg-muted hover:text-fg"
                }`}
              >
                {locale.toUpperCase()}
                <span className="sr-only"> — {t(locale)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
