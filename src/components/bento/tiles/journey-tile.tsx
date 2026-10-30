import { useLocale, useTranslations } from "next-intl";
import { ViewTransition, type ReactNode } from "react";

import { Period } from "@/components/content/period";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { Eyebrow } from "@/components/ui/eyebrow";
import { MediaImage } from "@/components/ui/media-image";
import type {
  CertificationView,
  EducationView,
} from "@/features/catalog/repository";
import { VIEW_TRANSITIONS } from "@/features/content/view-names";
import type { TileSize } from "@/features/content/vocabulary";
import type { MediaView } from "@/features/media/types";

import { Tile, TileLink } from "../tile";

/** What the tile lists at most: the latest education, then certifications. */
const MAX_ITEMS = 3;

interface JourneyItemProps {
  readonly image: MediaView | undefined;
  /** Whether any item has an image: the others keep its room, aligned. */
  readonly hasImages: boolean;
  /** "formation", "certification": said before the item, not shown. */
  readonly kind: string;
  readonly children: ReactNode;
}

function JourneyItem({ image, hasImages, kind, children }: JourneyItemProps) {
  return (
    <li className="flex items-center gap-3">
      {image !== undefined ? (
        // Its name is beside it: the logo or badge adorns the name.
        <MediaImage
          image={image}
          alt=""
          sizes="40px"
          className="border-line rounded-control size-10 shrink-0 border bg-white object-contain p-1"
        />
      ) : (
        hasImages && <span aria-hidden="true" className="size-10 shrink-0" />
      )}
      {/* Whitespace between flex items takes no room, but keeps words apart when read. */}
      <span className="flex min-w-0 flex-col wrap-anywhere">
        <span className="sr-only">{kind}</span> {children}
      </span>
    </li>
  );
}

interface JourneyTileProps {
  readonly size: TileSize;
  /** From the most recent start. */
  readonly education: readonly EducationView[];
  /** From the most recent. */
  readonly certifications: readonly CertificationView[];
}

/**
 * The most recent education, then the latest certifications. Morphs into the
 * journey page, which lists them all, with the platforms.
 */
export function JourneyTile({
  size,
  education,
  certifications,
}: JourneyTileProps) {
  const t = useTranslations("Home");
  const locale = useLocale();
  const titleId = `journey-title-${locale}`;
  const [latest] = education;
  const shown = certifications.slice(
    0,
    latest === undefined ? MAX_ITEMS : MAX_ITEMS - 1,
  );
  const hasImages =
    latest?.logo !== undefined ||
    shown.some((certification) => certification.badge !== undefined);

  return (
    <ViewTransition
      name={VIEW_TRANSITIONS.journey}
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
          <Eyebrow as="h2" id={titleId}>
            <TileLink href="/journey">{t("journey")}</TileLink>
          </Eyebrow>
          <ArrowIcon />
        </div>
        {/* role="list": Safari drops list semantics once list-style is none. */}
        <ul role="list" className="flex flex-col gap-2">
          {latest !== undefined && (
            <JourneyItem
              image={latest.logo}
              hasImages={hasImages}
              kind={t("journeyEducation")}
            >
              <span
                lang={latest.isFallback ? latest.contentLocale : undefined}
                // Two lines at most, so the hub keeps to one screen; read whole.
                className="line-clamp-2 font-medium"
              >
                {latest.degree}
              </span>{" "}
              <span className="text-fg-muted text-sm">
                {latest.school}
                {" · "}
                <span className="whitespace-nowrap">
                  <Period
                    startedOn={latest.startedOn}
                    endedOn={latest.endedOn}
                    isYearOnly
                  />
                </span>
              </span>
            </JourneyItem>
          )}
          {shown.map((certification) => (
            <JourneyItem
              key={certification.slug}
              image={certification.badge}
              hasImages={hasImages}
              kind={t("journeyCertification")}
            >
              <span className="font-medium">{certification.name}</span>{" "}
              <span className="text-fg-muted text-sm">
                {certification.issuer}
              </span>
            </JourneyItem>
          ))}
        </ul>
      </Tile>
    </ViewTransition>
  );
}
