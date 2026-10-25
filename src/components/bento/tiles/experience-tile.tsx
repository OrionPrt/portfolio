import { useFormatter, useLocale, useTranslations } from "next-intl";
import { ViewTransition } from "react";

import { ArrowIcon } from "@/components/ui/arrow-icon";
import { Eyebrow } from "@/components/ui/eyebrow";
import { experienceTransitionName } from "@/features/content/view-names";
import type { TileSize } from "@/features/content/vocabulary";
import type { ExperienceView } from "@/features/experiences/repository";
import { MONTH_YEAR, utcDate } from "@/lib/dates";

import { Tile, TileLink } from "../tile";

interface ExperienceTileProps {
  readonly size: TileSize;
  readonly experience: ExperienceView;
}

/** The current position. Morphs into its full-screen view. */
export function ExperienceTile({ size, experience }: ExperienceTileProps) {
  const t = useTranslations("Home");
  const format = useFormatter();
  const locale = useLocale();
  const titleId = `experience-${experience.slug}-title-${locale}`;
  const since = format.dateTime(utcDate(experience.startedOn), MONTH_YEAR);

  return (
    <ViewTransition
      name={experienceTransitionName(experience.slug)}
      share="morph"
      default="none"
    >
      <Tile
        size={size}
        labelledBy={titleId}
        isInteractive
        className="justify-between"
      >
        <div className="text-fg-muted flex items-center justify-between">
          <Eyebrow>{t("experience")}</Eyebrow>
          <ArrowIcon />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2
            id={titleId}
            lang={experience.isFallback ? experience.contentLocale : undefined}
            className="text-xl font-semibold tracking-tight"
          >
            <TileLink
              href={{
                pathname: "/experiences/[slug]",
                params: { slug: experience.slug },
              }}
            >
              {experience.role}
            </TileLink>
          </h2>
          <p className="text-fg-muted text-sm">
            {experience.company} · {t("since", { date: since })}
          </p>
        </div>
      </Tile>
    </ViewTransition>
  );
}
