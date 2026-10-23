import { useLocale, useTranslations } from "next-intl";
import { ViewTransition } from "react";

import { FEATURED_PLACEHOLDER_PROJECT } from "@/features/projects/placeholder-projects";
import { projectTransitionName } from "@/features/projects/transition-names";
import { Link } from "@/i18n/navigation";

const tileClassName = "bg-surface border-line rounded-tile border";

// P1 prototype of the bento hub (ADR-0003): three tiles, one of which expands
// into its full-screen view. P3 replaces it with the complete grid.
export default function HomePage() {
  const t = useTranslations("Home");
  const tProject = useTranslations("Project");
  // Ids are scoped by locale: Cache Components keeps the other locale's home mounted.
  const locale = useLocale();
  const project = FEATURED_PLACEHOLDER_PROJECT;

  return (
    <div className="grid flex-1 gap-3 lg:grid-cols-4 lg:grid-rows-[repeat(3,minmax(176px,auto))]">
      <section
        aria-labelledby={`identity-title-${locale}`}
        className={`${tileClassName} flex flex-col justify-between gap-7 p-8 lg:col-span-2 lg:row-span-2`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-accent font-mono text-xs tracking-wide">
            <span aria-hidden="true">● </span>
            {t("status")}
          </p>
          <h1
            id={`identity-title-${locale}`}
            className="text-[clamp(48px,5.6vw,80px)] leading-[0.95] font-semibold tracking-[-0.05em]"
          >
            Orion
          </h1>
          <p className="text-[clamp(19px,1.8vw,24px)] leading-snug font-medium tracking-tight">
            {t("role")}
          </p>
          <p className="text-fg-muted max-w-[48ch] leading-relaxed">
            {t("pitch")}
          </p>
        </div>
      </section>

      <ViewTransition
        name={projectTransitionName(project.slug)}
        share="morph"
        default="none"
      >
        {/* Stretched-link card: the title is the link and its ::after covers the tile,
            so the whole card is clickable while the link's name matches its visible text. */}
        <div
          className={`${tileClassName} group has-focus-visible:outline-focus relative flex flex-col gap-4 p-7 has-focus-visible:outline-2 has-focus-visible:outline-offset-3 lg:col-span-2 lg:row-span-2`}
        >
          <div className="text-fg-muted flex items-center justify-between font-mono text-xs">
            <span>
              <span aria-hidden="true">{"// "}</span>
              {t("featuredProject")}
            </span>
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            >
              <path d="M7 17 17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </div>
          <h2 className="text-[clamp(24px,2.4vw,32px)] leading-tight font-semibold tracking-[-0.035em]">
            <Link
              href={{
                pathname: "/projects/[slug]",
                params: { slug: project.slug },
              }}
              prefetch
              className="after:rounded-tile outline-none after:absolute after:inset-0"
            >
              {tProject("placeholderName")}
            </Link>
          </h2>
          <p className="text-fg-muted max-w-[54ch] leading-relaxed">
            {tProject("summary")}
          </p>
          <div className="bg-surface-muted border-line text-fg-muted flex min-h-32 flex-1 items-center justify-center rounded-[10px] border font-mono text-xs">
            {tProject("placeholderVisual")}
          </div>
        </div>
      </ViewTransition>

      <section
        aria-labelledby={`experience-title-${locale}`}
        className={`${tileClassName} flex flex-col justify-between gap-4 p-6`}
      >
        <p className="text-fg-muted font-mono text-xs">
          <span aria-hidden="true">{"// "}</span>
          {t("experience")}
        </p>
        <div className="flex flex-col gap-1.5">
          <h2
            id={`experience-title-${locale}`}
            className="text-xl font-semibold tracking-tight"
          >
            {t("experienceRole")}
          </h2>
          <p className="text-fg-muted text-sm">{t("experienceCompany")}</p>
        </div>
      </section>
    </div>
  );
}
