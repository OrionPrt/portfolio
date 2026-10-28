import { useLocale, useTranslations } from "next-intl";
import { ViewTransition } from "react";

import { Period } from "@/components/content/period";
import { SkillBadge } from "@/components/content/skill-badge";
import { TwoLevelContent } from "@/components/content/two-level-content";
import { ViewShell } from "@/components/content/view-shell";
import { CHIP_CLASSES } from "@/components/ui/chip-classes";
import { MediaImage } from "@/components/ui/media-image";
import { projectTransitionName } from "@/features/content/view-names";
import type { ProjectView } from "@/features/projects/types";
import { Link } from "@/i18n/navigation";

const EXTERNAL_LINK_CLASSES =
  "text-fg underline underline-offset-4 hover:text-accent";

interface ProjectDetailProps {
  readonly project: ProjectView;
}

/** A project's full-screen view: the featured tile morphs into it. */
export function ProjectDetail({ project }: ProjectDetailProps) {
  const t = useTranslations("Projects");
  const tProject = useTranslations("Project");
  const tDomains = useTranslations("Domains");
  const locale = useLocale();
  const idPrefix = `project-${project.slug}-${locale}`;
  const lang = project.isFallback ? project.contentLocale : undefined;

  return (
    <ViewTransition
      name={projectTransitionName(project.slug)}
      share="morph"
      default="none"
    >
      <ViewShell
        titleId={`${idPrefix}-title`}
        label={tProject("label")}
        title={project.title}
        lead={project.tagline}
        lang={lang}
      >
        <div className="text-fg-muted flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <span className={CHIP_CLASSES}>{tDomains(project.domain)}</span>
          <Period startedOn={project.startedOn} endedOn={project.endedOn} />
          {project.repoUrl !== null && (
            <a
              href={project.repoUrl}
              rel="noopener noreferrer"
              className={EXTERNAL_LINK_CLASSES}
            >
              {t("repo")}
            </a>
          )}
          {project.demoUrl !== null && (
            <a
              href={project.demoUrl}
              rel="noopener noreferrer"
              className={EXTERNAL_LINK_CLASSES}
            >
              {t("demo")}
            </a>
          )}
        </div>
        {project.cover !== undefined && (
          // The page's main image: described, and fetched at once.
          <MediaImage
            image={project.cover}
            sizes="(min-width: 1280px) 1100px, 100vw"
            isPriority
            className="border-line rounded-tile bg-surface-muted max-h-[70vh] w-full border object-contain"
          />
        )}
        <TwoLevelContent
          idPrefix={idPrefix}
          summary={project.summary}
          technicalMd={project.technicalMd}
          lang={lang}
        />
        {project.skills.length > 0 && (
          <section
            aria-labelledby={`${idPrefix}-stack`}
            className="flex flex-col gap-3"
          >
            <h2
              id={`${idPrefix}-stack`}
              className="text-lg font-semibold tracking-tight"
            >
              {tProject("stack")}
            </h2>
            <ul className="flex flex-wrap gap-1.5">
              {project.skills.map((skill) => (
                <li key={skill.slug}>
                  <SkillBadge skill={skill} />
                </li>
              ))}
            </ul>
          </section>
        )}
        <Link
          href="/projects"
          className="text-fg-muted hover:text-fg mt-auto self-start font-mono text-xs"
        >
          {t("all")} <span aria-hidden="true">→</span>
        </Link>
      </ViewShell>
    </ViewTransition>
  );
}
