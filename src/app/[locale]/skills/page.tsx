import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DataUnavailable } from "@/components/content/data-unavailable";
import { ViewShell } from "@/components/content/view-shell";
import { SkillsView } from "@/components/skills/skills-view";
import { getSkills } from "@/features/catalog/queries";
import { skillUsage } from "@/features/content/skill-usage";
import { getPublishedExperiences } from "@/features/experiences/queries";
import { getPublishedProjects } from "@/features/projects/queries";
import { localizedAlternates } from "@/features/seo/alternates";
import { routing } from "@/i18n/routing";
import { unwrapOr } from "@/lib/result";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/skills">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "Skills" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localizedAlternates(locale, "/skills"),
  };
}

// Blocking render, like every page (ADR-0002, ADR-0003).
export const instant = false;

export default async function SkillsPage({
  params,
}: PageProps<"/[locale]/skills">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const [skills, projects, experiences] = await Promise.all([
    getSkills(),
    getPublishedProjects(locale),
    getPublishedExperiences(locale),
  ]);
  if (!skills.ok) {
    const t = await getTranslations({ locale, namespace: "Skills" });
    return (
      <ViewShell
        titleId={`skills-title-${locale}`}
        label={t("label")}
        title={t("title")}
      >
        <DataUnavailable />
      </ViewShell>
    );
  }
  // Without projects or experiences, skills still show, just unlinked.
  const usage = skillUsage(unwrapOr(projects, []), unwrapOr(experiences, []));
  return <SkillsView skills={skills.data} usage={usage} />;
}
