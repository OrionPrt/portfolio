import { render, type RenderResult } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import type { Locale } from "@/i18n/locales";

import en from "../messages/en.json";
import fr from "../messages/fr.json";

const MESSAGES = { fr, en } as const;

/** Renders a component with the app's messages, locale and time zone. */
export function renderWithIntl(
  ui: ReactElement,
  locale: Locale = "fr",
): RenderResult {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={MESSAGES[locale]}
      timeZone="Europe/Paris"
    >
      {ui}
    </NextIntlClientProvider>,
  );
}
