import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DataUnavailable } from "@/components/content/data-unavailable";
import { JourneyView } from "@/components/journey/journey-view";
import { getCertifications, getEducation } from "@/features/catalog/queries";
import { getPlatforms } from "@/features/platforms/queries";
import { localizedAlternates } from "@/features/seo/alternates";
import { routing } from "@/i18n/routing";
import { unwrapOr } from "@/lib/result";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/journey">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "Journey" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localizedAlternates(locale, "/journey"),
  };
}

// Blocking render, like every page (ADR-0002, ADR-0003).
export const instant = false;

/** Education, certifications and platforms: each section shows what could be read. */
export default async function JourneyPage({
  params,
}: PageProps<"/[locale]/journey">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const reads = await Promise.all([
    getEducation(locale),
    getCertifications(locale),
    getPlatforms(),
  ]);
  const [education, certifications, platforms] = reads;

  return (
    <div className="flex flex-1 flex-col gap-3">
      {reads.some((read) => !read.ok) && <DataUnavailable />}
      <JourneyView
        education={unwrapOr(education, [])}
        certifications={unwrapOr(certifications, [])}
        platforms={unwrapOr(platforms, [])}
        isUnavailable={reads.some((read) => !read.ok)}
      />
    </div>
  );
}
