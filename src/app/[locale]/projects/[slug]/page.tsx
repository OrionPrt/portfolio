import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound, permanentRedirect } from "next/navigation";

import { DataUnavailable } from "@/components/content/data-unavailable";
import { ProjectDetail } from "@/components/projects/project-detail";
import { JsonLd } from "@/components/seo/json-ld";
import { movedSlug } from "@/features/content/moved-slugs";
import { getMarkdownImages } from "@/features/media/queries";
import { getPublishedProject } from "@/features/projects/queries";
import { localizedAlternates } from "@/features/seo/alternates";
import { projectJsonLd } from "@/features/seo/json-ld";
import { siteUrl } from "@/features/seo/site-url";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { SITE_NAME } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const project = await getPublishedProject(slug, locale);
  // Unknown or unreadable: the page renders not-found or the outage notice.
  if (!project.ok || project.data === undefined) {
    return {};
  }
  return {
    title: project.data.title,
    description: project.data.seoDescription ?? project.data.tagline,
    alternates: localizedAlternates(locale, {
      pathname: "/projects/[slug]",
      params: { slug },
    }),
  };
}

// Blocking render, like every page (ADR-0002): the root layout's opt-out only
// covers navigations into [locale], not between its pages. A Suspense boundary
// would also break the morph, which needs the whole view in one commit (ADR-0003).
export const instant = false;

export default async function ProjectPage({
  params,
}: PageProps<"/[locale]/projects/[slug]">) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const project = await getPublishedProject(slug, locale);
  if (!project.ok) {
    return <DataUnavailable />;
  }
  // The proxy already answered 404 for unknown slugs: this is the soft fallback.
  if (project.data === undefined) {
    // Renamed a moment ago: the proxy's lists have yet to learn it.
    const moved = await movedSlug("projects", slug);
    if (moved !== undefined) {
      permanentRedirect(
        getPathname({
          locale,
          href: { pathname: "/projects/[slug]", params: { slug: moved } },
        }),
      );
    }
    notFound();
  }
  const href = { pathname: "/projects/[slug]", params: { slug } } as const;
  return (
    <>
      <JsonLd
        data={projectJsonLd({
          name: project.data.title,
          description: project.data.seoDescription ?? project.data.tagline,
          url: new URL(getPathname({ locale, href }), siteUrl()).href,
          language: project.data.contentLocale,
          authorName: SITE_NAME,
          keywords: project.data.skills.map((skill) => skill.name),
          repoUrl: project.data.repoUrl,
        })}
      />
      <ProjectDetail
        project={project.data}
        images={await getMarkdownImages(project.data.technicalMd, locale)}
      />
    </>
  );
}
