import { useLocale, useTranslations } from "next-intl";

import { TileLink } from "@/components/bento/tile";
import { Period } from "@/components/content/period";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { CHIP_CLASSES } from "@/components/ui/chip-classes";
import type { ExperienceView } from "@/features/experiences/repository";

interface ExperienceCardProps {
  readonly experience: ExperienceView;
}

/** A position in the list: a card whose role links to the full view. */
export function ExperienceCard({ experience }: ExperienceCardProps) {
  const t = useTranslations("Experiences");
  const tTypes = useTranslations("EmploymentTypes");
  const locale = useLocale();
  const titleId = `experience-card-${experience.slug}-${locale}`;

  return (
    <article
      aria-labelledby={titleId}
      className="group bg-surface border-line rounded-tile hover:border-fg-muted has-focus-visible:outline-focus relative flex flex-col gap-2 border p-6 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
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
          {experience.company} · {tTypes(experience.employmentType)}
        </p>
      </div>
      <div className="text-fg-muted flex items-center gap-4 text-sm">
        {experience.isCurrent && (
          <span className={CHIP_CLASSES}>{t("current")}</span>
        )}
        <Period startedOn={experience.startedOn} endedOn={experience.endedOn} />
        <ArrowIcon />
      </div>
    </article>
  );
}
