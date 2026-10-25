import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AboutView } from "@/components/about/about-view";
import { DataUnavailable } from "@/components/content/data-unavailable";
import { ViewShell } from "@/components/content/view-shell";
import { getProfile } from "@/features/profile/queries";
import { localizedAlternates } from "@/features/seo/alternates";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "About" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localizedAlternates(locale, "/about"),
  };
}

// Blocking render, like every page (ADR-0002, ADR-0003).
export const instant = false;

export default async function AboutPage({
  params,
}: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const profile = await getProfile(locale);
  if (profile.ok && profile.data !== undefined) {
    return <AboutView profile={profile.data} />;
  }
  // No profile stored yet, or the database is down: the page still stands.
  const t = await getTranslations({ locale, namespace: "About" });
  return (
    <ViewShell
      titleId={`about-${locale}-title`}
      label={t("label")}
      title={t("title")}
    >
      <DataUnavailable />
    </ViewShell>
  );
}
