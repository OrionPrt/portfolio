import { render, type RenderResult } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

import type { Locale } from "@/i18n/locales";

import en from "../messages/en.json";
import fr from "../messages/fr.json";

const MESSAGES = { fr, en } as const;

interface IntlWrapperProps {
  readonly children: ReactNode;
}

/**
 * Renders a component with the app's messages, locale and time zone. The
 * provider is a wrapper, so `rerender` keeps it.
 */
export function renderWithIntl(
  ui: ReactElement,
  locale: Locale = "fr",
): RenderResult {
  function IntlWrapper({ children }: IntlWrapperProps) {
    return (
      <NextIntlClientProvider
        locale={locale}
        messages={MESSAGES[locale]}
        timeZone="Europe/Paris"
      >
        {children}
      </NextIntlClientProvider>
    );
  }
  return render(ui, { wrapper: IntlWrapper });
}
