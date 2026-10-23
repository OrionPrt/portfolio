import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";

import { findPlaceholderProject } from "@/features/projects/placeholder-projects";
import { projectTransitionName } from "@/features/projects/transition-names";
import { Link } from "@/i18n/navigation";

// Blocking render, like every page (ADR-0002): the root layout's opt-out only
// covers navigations into [locale], not between its pages. A Suspense boundary
// would also break the morph, which needs the whole view in one commit (ADR-0003).
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  // An unknown slug renders the not-found page: never title it after a project.
  if (findPlaceholderProject(slug) === undefined) {
    return {};
  }
  const t = await getTranslations("Project");
  return { title: t("placeholderName") };
}

// Full-screen view of a project. The tile on the home page carries the same
// view-transition name, so navigating between them morphs one into the other.
export default async function ProjectPage({
  params,
}: PageProps<"/[locale]/projects/[slug]">) {
  const { locale, slug } = await params;
  // Scoped by locale and slug: other visited project pages stay mounted (hidden).
  const titleId = `project-${slug}-title-${locale}`;
  const project = findPlaceholderProject(slug);
  if (project === undefined) {
    notFound();
  }
  const t = await getTranslations("Project");

  return (
    <ViewTransition
      name={projectTransitionName(project.slug)}
      share="morph"
      default="none"
    >
      <article
        aria-labelledby={titleId}
        className="bg-surface border-line rounded-tile flex flex-1 flex-col gap-6 border p-8 lg:p-12"
      >
        <Link
          href="/"
          className="text-fg-muted hover:text-fg rounded-control self-start font-mono text-xs"
        >
          <span aria-hidden="true">← </span>
          {t("backHome")}
        </Link>
        <p className="text-fg-muted font-mono text-xs">
          <span aria-hidden="true">{"// "}</span>
          {t("label")}
        </p>
        <h1
          id={titleId}
          className="text-[clamp(36px,5vw,64px)] leading-[1.05] font-semibold tracking-[-0.045em]"
        >
          {t("placeholderName")}
        </h1>
        <p className="text-fg-muted max-w-prose text-lg leading-relaxed">
          {t("summary")}
        </p>
        <div className="bg-surface-muted border-line text-fg-muted flex min-h-64 flex-1 items-center justify-center rounded-[10px] border font-mono text-xs">
          {t("placeholderVisual")}
        </div>
      </article>
    </ViewTransition>
  );
}
