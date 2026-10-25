import { useLocale, useTranslations } from "next-intl";

import { BUTTON_CLASSES } from "@/components/ui/button-classes";
import type { SkillRef } from "@/features/content/types";
import type { SkillDomain } from "@/features/content/vocabulary";
import type { ProjectFilters } from "@/features/projects/filters";
import { Link } from "@/i18n/navigation";

const SELECT_CLASSES =
  "border-control-border bg-surface text-fg rounded-control h-10 border px-3 text-sm";

interface ProjectFiltersFormProps {
  readonly filters: ProjectFilters;
  readonly domains: readonly SkillDomain[];
  readonly skills: readonly SkillRef[];
}

/** A plain GET form: filters live in the URL and work without JavaScript. */
export function ProjectFiltersForm({
  filters,
  domains,
  skills,
}: ProjectFiltersFormProps) {
  const t = useTranslations("Projects");
  const tDomains = useTranslations("Domains");
  const locale = useLocale();
  const hasFilters =
    filters.domain !== undefined || filters.skill !== undefined;

  return (
    <form
      method="get"
      role="search"
      aria-label={t("filters")}
      className="flex flex-wrap items-end gap-3"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("domain")}
        <select
          id={`filter-domain-${locale}`}
          name="domain"
          defaultValue={filters.domain ?? ""}
          className={SELECT_CLASSES}
        >
          <option value="">{t("any")}</option>
          {domains.map((domain) => (
            <option key={domain} value={domain}>
              {tDomains(domain)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("skill")}
        <select
          id={`filter-skill-${locale}`}
          name="skill"
          defaultValue={filters.skill ?? ""}
          className={SELECT_CLASSES}
        >
          <option value="">{t("any")}</option>
          {skills.map((skill) => (
            <option key={skill.slug} value={skill.slug}>
              {skill.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={BUTTON_CLASSES.secondary}>
        {t("apply")}
      </button>
      {hasFilters && (
        <Link
          href="/projects"
          className="text-fg-muted hover:text-fg flex h-10 items-center text-sm underline underline-offset-4"
        >
          {t("reset")}
        </Link>
      )}
    </form>
  );
}
