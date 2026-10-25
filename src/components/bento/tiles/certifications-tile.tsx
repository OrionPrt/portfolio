import { useLocale, useTranslations } from "next-intl";

import { Eyebrow } from "@/components/ui/eyebrow";
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

  return (
    <Tile size={size} labelledBy={titleId} className="justify-between">
      <Eyebrow as="h2" id={titleId}>
        {t("certifications")}
      </Eyebrow>
      <ul className="flex flex-col gap-2">
        {certifications.slice(0, MAX_SHOWN).map((certification) => (
          <li key={certification.slug} className="flex flex-col">
            <span className="font-medium">{certification.name}</span>
            <span className="text-fg-muted text-sm">
              {certification.issuer}
            </span>
          </li>
        ))}
      </ul>
    </Tile>
  );
}
