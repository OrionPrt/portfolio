import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { DataUnavailable } from "@/components/content/data-unavailable";
import { ExperienceDetail } from "@/components/experiences/experience-detail";
import { getPublishedExperience } from "@/features/experiences/queries";
import { localizedAlternates } from "@/features/seo/alternates";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/experiences/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const experience = await getPublishedExperience(slug, locale);
  if (!experience.ok || experience.data === undefined) {
    return {};
  }
  return {
    title: `${experience.data.role} — ${experience.data.company}`,
    description: experience.data.summary.result,
    alternates: localizedAlternates(locale, {
      pathname: "/experiences/[slug]",
      params: { slug },
    }),
  };
}

// Blocking render, like every page (ADR-0002, ADR-0003).
export const instant = false;

export default async function ExperiencePage({
  params,
}: PageProps<"/[locale]/experiences/[slug]">) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const experience = await getPublishedExperience(slug, locale);
  if (!experience.ok) {
    return <DataUnavailable />;
  }
  // The proxy already answered 404 for unknown slugs: this is the soft fallback.
  if (experience.data === undefined) {
    notFound();
  }
  return <ExperienceDetail experience={experience.data} />;
}
