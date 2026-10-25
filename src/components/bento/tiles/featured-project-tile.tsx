import { useLocale, useTranslations } from "next-intl";
import { ViewTransition } from "react";

import { ArrowIcon } from "@/components/ui/arrow-icon";
import { CHIP_CLASSES } from "@/components/ui/chip-classes";
import { Eyebrow } from "@/components/ui/eyebrow";
import { projectTransitionName } from "@/features/content/view-names";
import type { TileSize } from "@/features/content/vocabulary";
import type { ProjectView } from "@/features/projects/types";

import { Tile, TileLink } from "../tile";

/** Enough to recognize the stack; the full list is on the project page. */
const MAX_CHIPS = 4;

interface FeaturedProjectTileProps {
  readonly size: TileSize;
  readonly project: ProjectView;
}

/** The project to read first. Morphs into its full-screen view. */
export function FeaturedProjectTile({
  size,
  project,
}: FeaturedProjectTileProps) {
  const t = useTranslations("Home");
  const locale = useLocale();
  const titleId = `featured-${project.slug}-title-${locale}`;
  const lang = project.isFallback ? project.contentLocale : undefined;

  return (
    <ViewTransition
      name={projectTransitionName(project.slug)}
      share="morph"
      default="none"
    >
      <Tile
        size={size}
        labelledBy={titleId}
        isInteractive
        className="gap-4 p-7"
      >
        <div className="text-fg-muted flex items-center justify-between">
          <Eyebrow>{t("featuredProject")}</Eyebrow>
          <ArrowIcon />
        </div>
        <h2
          id={titleId}
          lang={lang}
          className="text-[clamp(24px,2.4vw,32px)] leading-tight font-semibold tracking-[-0.035em]"
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
        <p
          lang={lang}
          className="text-fg-muted max-w-[54ch] text-lg leading-snug"
        >
          {project.tagline}
        </p>
        <p lang={lang} className="max-w-[54ch] leading-relaxed">
          {project.summary.result}
        </p>
        <ul className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {project.skills.slice(0, MAX_CHIPS).map((skill) => (
            <li key={skill.slug} className={CHIP_CLASSES}>
              {skill.name}
            </li>
          ))}
        </ul>
      </Tile>
    </ViewTransition>
  );
}
