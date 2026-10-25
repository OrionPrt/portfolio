import { useLocale, useTranslations } from "next-intl";

import { TileLink } from "@/components/bento/tile";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { CHIP_CLASSES } from "@/components/ui/chip-classes";
import type { ProjectView } from "@/features/projects/types";

interface ProjectCardProps {
  readonly project: ProjectView;
}

/** A project in the list: a card whose title links to the full view. */
export function ProjectCard({ project }: ProjectCardProps) {
  const tDomains = useTranslations("Domains");
  const locale = useLocale();
  const titleId = `project-card-${project.slug}-${locale}`;
  const lang = project.isFallback ? project.contentLocale : undefined;

  return (
    <article
      aria-labelledby={titleId}
      className="group bg-surface border-line rounded-tile hover:border-fg-muted has-focus-visible:outline-focus relative flex h-full flex-col gap-3 border p-6 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-3"
    >
      <div className="text-fg-muted flex items-center justify-between">
        <span className={CHIP_CLASSES}>{tDomains(project.domain)}</span>
        <ArrowIcon />
      </div>
      <h2
        id={titleId}
        lang={lang}
        className="text-xl font-semibold tracking-tight"
      >
        <TileLink
          href={{
            pathname: "/projects/[slug]",
            params: { slug: project.slug },
          }}
        >
          {project.title}
        </TileLink>
      </h2>
      <p lang={lang} className="text-fg-muted leading-relaxed">
        {project.tagline}
      </p>
      <ul className="mt-auto flex flex-wrap gap-1.5 pt-2">
        {project.skills.map((skill) => (
          <li key={skill.slug} className={CHIP_CLASSES}>
            {skill.name}
          </li>
        ))}
      </ul>
    </article>
  );
}
