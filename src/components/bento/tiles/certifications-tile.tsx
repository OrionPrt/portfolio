import { useLocale, useTranslations } from "next-intl";

import { Eyebrow } from "@/components/ui/eyebrow";
import { MediaImage } from "@/components/ui/media-image";
import type { CertificationView } from "@/features/catalog/repository";
import type { TileSize } from "@/features/content/vocabulary";

import { Tile } from "../tile";

/** The most recent ones; the certifications page (P8) lists them all. */
const MAX_SHOWN = 3;

interface CertificationsTileProps {
  readonly size: TileSize;
  readonly certifications: readonly CertificationView[];
}

export function CertificationsTile({
  size,
  certifications,
}: CertificationsTileProps) {
  const t = useTranslations("Home");
  const locale = useLocale();
  const titleId = `certifications-title-${locale}`;
  const shown = certifications.slice(0, MAX_SHOWN);
  const hasBadges = shown.some(
    (certification) => certification.badge !== undefined,
  );

  return (
    <Tile size={size} labelledBy={titleId} className="justify-between">
      <Eyebrow as="h2" id={titleId}>
        {t("certifications")}
      </Eyebrow>
      <ul className="flex flex-col gap-2">
        {shown.map((certification) => (
          <li key={certification.slug} className="flex items-center gap-3">
            {certification.badge !== undefined ? (
              // Its name is beside it: the badge adorns the name.
              <MediaImage
                image={certification.badge}
                alt=""
                sizes="40px"
                className="border-line rounded-control size-10 shrink-0 border bg-white object-contain p-1"
              />
            ) : (
              // The names stay aligned with those beside a badge.
              hasBadges && (
                <span aria-hidden="true" className="size-10 shrink-0" />
              )
            )}
            <span className="flex flex-col">
              <span className="font-medium">{certification.name}</span>
              <span className="text-fg-muted text-sm">
                {certification.issuer}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Tile>
  );
}
