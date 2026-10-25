import { useLocale, useTranslations } from "next-intl";
import { ViewTransition } from "react";

import { ViewShell } from "@/components/content/view-shell";
import { CHIP_CLASSES } from "@/components/ui/chip-classes";
import type { SkillView } from "@/features/catalog/repository";
import { groupSkillsByDomain } from "@/features/content/skill-groups";
import type { SkillUsage } from "@/features/content/skill-usage";
import { skillAnchor, VIEW_TRANSITIONS } from "@/features/content/view-names";
import { Link } from "@/i18n/navigation";

const USAGE_LINK_CLASSES = "hover:text-accent underline underline-offset-4";

/** A skill reached through its anchor stands out, below a little headroom. */
const TARGET_CLASSES =
  "target:border-accent target:bg-surface-muted scroll-mt-6";

const NO_USAGE: SkillUsage = { projects: [], experiences: [] };

interface SkillsViewProps {
  readonly skills: readonly SkillView[];
  readonly usage: ReadonlyMap<string, SkillUsage>;
}

interface SkillUsageListProps {
  readonly usage: SkillUsage;
}

function SkillUsageList({ usage }: SkillUsageListProps) {
  const t = useTranslations("Skills");
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {usage.projects.map((project) => (
        <li key={`project-${project.slug}`}>
          <span className="text-fg-muted font-mono text-xs">
            {t("projects")} ·{" "}
          </span>
          <Link
            href={{
              pathname: "/projects/[slug]",
              params: { slug: project.slug },
            }}
            lang={project.lang}
            className={USAGE_LINK_CLASSES}
          >
            {project.title}
          </Link>
        </li>
      ))}
      {usage.experiences.map((experience) => (
        <li key={`experience-${experience.slug}`}>
          <span className="text-fg-muted font-mono text-xs">
            {t("experiences")} ·{" "}
          </span>
          <Link
            href={{
              pathname: "/experiences/[slug]",
              params: { slug: experience.slug },
            }}
            lang={experience.lang}
            className={USAGE_LINK_CLASSES}
          >
            {experience.role} — {experience.company}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Skills not used by a published project or position yet: names only, still anchored. */
interface UnusedSkillsProps {
  readonly skills: readonly SkillView[];
}

function UnusedSkills({ skills }: UnusedSkillsProps) {
  const t = useTranslations("Skills");
  const locale = useLocale();
  if (skills.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-fg-muted text-sm">{t("unused")}</p>
      <ul className="flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <li
            key={skill.slug}
            id={skillAnchor(skill.slug, locale)}
            tabIndex={-1}
            className={`${CHIP_CLASSES} ${TARGET_CLASSES}`}
          >
            {skill.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Skills by domain, each linked to where it was used. The stack tile morphs into it. */
export function SkillsView({ skills, usage }: SkillsViewProps) {
  const t = useTranslations("Skills");
  const tTitles = useTranslations("DomainTitles");
  const locale = useLocale();

  return (
    <ViewTransition name={VIEW_TRANSITIONS.stack} share="morph" default="none">
      <ViewShell
        titleId={`skills-title-${locale}`}
        label={t("label")}
        title={t("title")}
        lead={t("intro")}
      >
        {groupSkillsByDomain(skills).map(({ domain, skills: inDomain }) => (
          <section
            key={domain}
            aria-labelledby={`domain-${domain}-${locale}`}
            className="flex flex-col gap-4"
          >
            <h2
              id={`domain-${domain}-${locale}`}
              className="text-xl font-semibold tracking-tight"
            >
              {tTitles(domain)}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {inDomain
                .filter((skill) => usage.has(skill.slug))
                .map((skill) => (
                  <li
                    key={skill.slug}
                    id={skillAnchor(skill.slug, locale)}
                    tabIndex={-1}
                    className={`border-line rounded-tile flex flex-col gap-2 border p-4 ${TARGET_CLASSES}`}
                  >
                    <h3 className="font-medium">{skill.name}</h3>
                    <SkillUsageList usage={usage.get(skill.slug) ?? NO_USAGE} />
                  </li>
                ))}
            </ul>
            <UnusedSkills
              skills={inDomain.filter((skill) => !usage.has(skill.slug))}
            />
          </section>
        ))}
      </ViewShell>
    </ViewTransition>
  );
}
