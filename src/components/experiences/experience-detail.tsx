import { useLocale, useTranslations } from "next-intl";
import { ViewTransition } from "react";

import { Period } from "@/components/content/period";
import { SkillBadge } from "@/components/content/skill-badge";
import { TwoLevelContent } from "@/components/content/two-level-content";
import { ViewShell } from "@/components/content/view-shell";
import { CHIP_CLASSES } from "@/components/ui/chip-classes";
import { MediaImage } from "@/components/ui/media-image";
import { experienceTransitionName } from "@/features/content/view-names";
import type { ExperienceView } from "@/features/experiences/repository";
import type { MediaById } from "@/features/media/types";
import { Link } from "@/i18n/navigation";

interface ExperienceDetailProps {
  readonly experience: ExperienceView;
  /** The library's images its technical text shows. */
  readonly images?: MediaById;
}

/** A position's full-screen view: the current-experience tile morphs into it. */
export function ExperienceDetail({
  experience,
  images,
}: ExperienceDetailProps) {
  const t = useTranslations("Experiences");
  const tExperience = useTranslations("Experience");
  const tTypes = useTranslations("EmploymentTypes");
  const locale = useLocale();
  const idPrefix = `experience-${experience.slug}-${locale}`;
  const lang = experience.isFallback ? experience.contentLocale : undefined;
  const company =
    experience.companyUrl === null ? (
      experience.company
    ) : (
      <a
        href={experience.companyUrl}
        rel="noopener noreferrer"
        className="text-fg hover:text-accent underline underline-offset-4"
      >
        {experience.company}
      </a>
    );

  return (
    <ViewTransition
      name={experienceTransitionName(experience.slug)}
      share="morph"
      default="none"
    >
      <ViewShell
        titleId={`${idPrefix}-title`}
        label={tExperience("label")}
        title={experience.role}
        lead={
          experience.logo === undefined ? (
            company
          ) : (
            <span className="flex items-center gap-3">
              {/* The company is named beside it: the logo adorns the name. */}
              <MediaImage
                image={experience.logo}
                alt=""
                sizes="56px"
                className="border-line rounded-control size-14 shrink-0 border bg-white object-contain p-1"
              />
              <span>{company}</span>
            </span>
          )
        }
        lang={lang}
      >
        <div className="text-fg-muted flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          {experience.isCurrent && (
            <span className={CHIP_CLASSES}>{t("current")}</span>
          )}
          <Period
            startedOn={experience.startedOn}
            endedOn={experience.endedOn}
          />
          <span>{tTypes(experience.employmentType)}</span>
          {experience.location !== null && <span>{experience.location}</span>}
        </div>
        <TwoLevelContent
          idPrefix={idPrefix}
          summary={experience.summary}
          technicalMd={experience.technicalMd}
          images={images}
          lang={lang}
        />
        {experience.skills.length > 0 && (
          <section
            aria-labelledby={`${idPrefix}-stack`}
            className="flex flex-col gap-3"
          >
            <h2
              id={`${idPrefix}-stack`}
              className="text-lg font-semibold tracking-tight"
            >
              {tExperience("stack")}
            </h2>
            <ul className="flex flex-wrap gap-1.5">
              {experience.skills.map((skill) => (
                <li key={skill.slug}>
                  <SkillBadge skill={skill} />
                </li>
              ))}
            </ul>
          </section>
        )}
        <Link
          href="/experiences"
          className="text-fg-muted hover:text-fg mt-auto self-start font-mono text-xs"
        >
          {t("all")} <span aria-hidden="true">→</span>
        </Link>
      </ViewShell>
    </ViewTransition>
  );
}
