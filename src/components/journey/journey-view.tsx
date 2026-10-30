import { useLocale, useTranslations } from "next-intl";
import { ViewTransition } from "react";

import { ViewShell } from "@/components/content/view-shell";
import type {
  CertificationView,
  EducationView,
} from "@/features/catalog/repository";
import { VIEW_TRANSITIONS } from "@/features/content/view-names";
import type { PlatformView } from "@/features/platforms/repository";

import {
  CertificationItem,
  EducationItem,
  JourneySection,
  PlatformItem,
} from "./journey-sections";

interface JourneyViewProps {
  /** From the most recent start. */
  readonly education: readonly EducationView[];
  /** From the most recent. */
  readonly certifications: readonly CertificationView[];
  /** In the admin's order. */
  readonly platforms: readonly PlatformView[];
  /** A read failed: the page says so already, so no section is called empty. */
  readonly isUnavailable?: boolean;
}

/**
 * The journey page: education, certifications and the platforms where I
 * train, each section shown once it has something. The journey tile morphs
 * into it.
 */
export function JourneyView({
  education,
  certifications,
  platforms,
  isUnavailable = false,
}: JourneyViewProps) {
  const t = useTranslations("Journey");
  const locale = useLocale();
  const idPrefix = `journey-${locale}`;
  const hasLogos = education.some((item) => item.logo !== undefined);
  const hasBadges = certifications.some((item) => item.badge !== undefined);
  const isEmpty =
    !isUnavailable &&
    education.length === 0 &&
    certifications.length === 0 &&
    platforms.length === 0;

  return (
    <ViewTransition
      name={VIEW_TRANSITIONS.journey}
      share="morph"
      default="none"
    >
      <ViewShell
        titleId={`${idPrefix}-title`}
        label={t("label")}
        title={t("title")}
        lead={t("description")}
      >
        {isEmpty && <p className="text-fg-muted">{t("empty")}</p>}
        {education.length > 0 && (
          <JourneySection id={`${idPrefix}-education`} title={t("education")}>
            {education.map((entry) => (
              <EducationItem
                key={entry.slug}
                entry={entry}
                hasImages={hasLogos}
              />
            ))}
          </JourneySection>
        )}
        {certifications.length > 0 && (
          <JourneySection
            id={`${idPrefix}-certifications`}
            title={t("certifications")}
          >
            {certifications.map((entry) => (
              <CertificationItem
                key={entry.slug}
                entry={entry}
                hasImages={hasBadges}
              />
            ))}
          </JourneySection>
        )}
        {platforms.length > 0 && (
          <JourneySection id={`${idPrefix}-platforms`} title={t("platforms")}>
            {platforms.map((entry) => (
              <PlatformItem key={entry.name} entry={entry} />
            ))}
          </JourneySection>
        )}
      </ViewShell>
    </ViewTransition>
  );
}
