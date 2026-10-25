import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DataUnavailable } from "@/components/content/data-unavailable";
import { ViewShell } from "@/components/content/view-shell";
import { ExperienceCard } from "@/components/experiences/experience-card";
import { getPublishedExperiences } from "@/features/experiences/queries";
import { localizedAlternates } from "@/features/seo/alternates";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/experiences">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "Experiences" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localizedAlternates(locale, "/experiences"),
  };
}

// Blocking render, like every page (ADR-0002, ADR-0003).
export const instant = false;

/** Every published position, the current one first. */
export default async function ExperiencesPage({
  params,
}: PageProps<"/[locale]/experiences">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const [t, experiences] = await Promise.all([
    getTranslations({ locale, namespace: "Experiences" }),
    getPublishedExperiences(locale),
  ]);

  return (
    <ViewShell
      titleId={`experiences-title-${locale}`}
      label={t("label")}
      title={t("title")}
    >
      {!experiences.ok && <DataUnavailable />}
      {experiences.ok && experiences.data.length === 0 && (
        <p className="text-fg-muted">{t("empty")}</p>
      )}
      {experiences.ok && experiences.data.length > 0 && (
        <ol className="flex flex-col gap-3">
          {experiences.data.map((experience) => (
            <li key={experience.slug}>
              <ExperienceCard experience={experience} />
            </li>
          ))}
        </ol>
      )}
    </ViewShell>
  );
}
