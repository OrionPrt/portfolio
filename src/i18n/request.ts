import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";

import { routing } from "./routing";

export default getRequestConfig(async ({ locale: explicitLocale }) => {
  // An explicit locale (getTranslations({ locale })) wins over the [locale] segment.
  const requested = explicitLocale ?? (await rootLocale());
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    // Fixed, so server and browser format dates alike; stored calendar days
    // are formatted in UTC on top of it (src/lib/dates.ts).
    timeZone: "Europe/Paris",
    messages: (
      (await import(`../../messages/${locale}.json`)) as {
        default: Record<string, unknown>;
      }
    ).default,
  };
});
