import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DataUnavailable } from "@/components/content/data-unavailable";
import { ViewShell } from "@/components/content/view-shell";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectFiltersForm } from "@/components/projects/project-filters-form";
import { SKILL_DOMAINS } from "@/features/content/vocabulary";
import {
  filterProjects,
  parseProjectFilters,
  skillsUsedBy,
} from "@/features/projects/filters";
import { getPublishedProjects } from "@/features/projects/queries";
import { localizedAlternates } from "@/features/seo/alternates";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "Projects" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localizedAlternates(locale, "/projects"),
  };
}

// Blocking render, like every page (ADR-0002, ADR-0003).
export const instant = false;

/** Every published project, filterable by domain and technology from the URL. */
export default async function ProjectsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/projects">) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const [t, projects] = await Promise.all([
    getTranslations({ locale, namespace: "Projects" }),
    getPublishedProjects(locale),
  ]);
  const shell = {
    titleId: `projects-title-${locale}`,
    label: t("label"),
    title: t("title"),
  };
  if (!projects.ok) {
    return (
      <ViewShell {...shell}>
        <DataUnavailable />
      </ViewShell>
    );
  }

  const filters = parseProjectFilters(query);
  const shown = filterProjects(projects.data, filters);
  const domains = SKILL_DOMAINS.filter((domain) =>
    projects.data.some((project) => project.domain === domain),
  );

  return (
    <ViewShell {...shell}>
      <div className="flex flex-col gap-4">
        <ProjectFiltersForm
          filters={filters}
          domains={domains}
          skills={skillsUsedBy(projects.data)}
        />
        <p className="text-fg-muted font-mono text-xs">
          {t("count", { count: shown.length })}
        </p>
      </div>
      {shown.length === 0 ? (
        <p className="text-fg-muted">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((project) => (
            <li key={project.slug}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}
    </ViewShell>
  );
}
