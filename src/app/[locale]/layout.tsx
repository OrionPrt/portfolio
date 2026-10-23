import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";
import { ThemeScript } from "@/components/theme/theme-script";
import { routing } from "@/i18n/routing";
import { currentYear } from "@/lib/current-year";

import "@/styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Every page is rendered per request so Next.js can sign its scripts with the
// CSP nonce generated in src/proxy.ts. Data stays cached with "use cache" (ADR-0002).
export const instant = false;

// Cache Components requires every root parameter to have known values.
export function generateStaticParams(): { locale: string }[] {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: { default: t("title"), template: "%s · Orion" },
    description: t("description"),
    // Kept out of search engines until launch (P12).
    robots: { index: false, follow: false },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Reading request headers makes the render per-request, which the nonce requires.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const year = await currentYear();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      // The theme script sets the class and color-scheme before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <ThemeScript nonce={nonce} />
      </head>
      <body className="bg-ground text-fg bg-dot-grid flex min-h-full flex-col">
        <NextIntlClientProvider>
          <SkipLink />
          <SiteHeader />
          <main
            id={`main-${locale}`}
            tabIndex={-1}
            className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-6 outline-none sm:px-8 lg:px-12"
          >
            {children}
          </main>
          <SiteFooter year={year} />
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
