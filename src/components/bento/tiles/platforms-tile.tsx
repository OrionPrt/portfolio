import { useFormatter, useLocale, useTranslations } from "next-intl";

import { Eyebrow } from "@/components/ui/eyebrow";
import type { TileSize } from "@/features/content/vocabulary";
import type { PlatformView } from "@/features/platforms/repository";
import { DAY_MONTH_YEAR, utcDate } from "@/lib/dates";

import { Tile } from "../tile";

/** What a single cell holds: the journey page lists them all. */
const MAX_SHOWN = 3;

interface PlatformsTileProps {
  readonly size: TileSize;
  readonly platforms: readonly PlatformView[];
}

/** The day of the oldest figures shown: none is fresher than that. */
function oldestOf(platforms: readonly PlatformView[]): string | undefined {
  return platforms
    .map((platform) => platform.updatedOn)
    .reduce<string | undefined>(
      (oldest, day) => (oldest === undefined || day < oldest ? day : oldest),
      undefined,
    );
}

/**
 * Where I train, with each platform's rank and points as entered in the
 * admin (ADR-0009); a name links to its profile when there is one.
 */
export function PlatformsTile({ size, platforms }: PlatformsTileProps) {
  const t = useTranslations("Home");
  const format = useFormatter();
  const locale = useLocale();
  const titleId = `platforms-title-${locale}`;
  const shown = platforms.slice(0, MAX_SHOWN);
  const hidden = platforms.length - shown.length;
  const oldest = oldestOf(shown);

  return (
    <Tile size={size} labelledBy={titleId} className="justify-between">
      <Eyebrow as="h2" id={titleId}>
        {t("platforms")}
      </Eyebrow>
      {/* role="list": Safari drops list semantics once list-style is none. */}
      <ul role="list" className="flex flex-col gap-2">
        {shown.map((platform) => (
          <li
            key={platform.name}
            className="flex items-baseline justify-between gap-3"
          >
            <span className="flex min-w-0 flex-col wrap-anywhere">
              {platform.profileUrl === null ? (
                <span className="font-medium">{platform.name}</span>
              ) : (
                <a
                  href={platform.profileUrl}
                  rel="noopener noreferrer"
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {platform.name}
                </a>
              )}{" "}
              {platform.rank !== null && (
                <span className="text-fg-muted text-sm">{platform.rank}</span>
              )}
            </span>{" "}
            {platform.points !== null && (
              <span className="text-accent shrink-0 font-mono text-sm">
                {/* "pts" fits the tile; a screen reader says "points". */}
                <span aria-hidden="true">
                  {t("platformPoints", { points: platform.points })}
                </span>
                <span className="sr-only">
                  {t("platformPointsLabel", { points: platform.points })}
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="text-fg-muted font-mono text-xs">
          <span aria-hidden="true">{t("moreSkills", { count: hidden })}</span>
          <span className="sr-only">
            {t("moreSkillsLabel", { count: hidden })}
          </span>
        </p>
      )}
      {oldest !== undefined && (
        <p className="text-fg-muted font-mono text-xs">
          {t("platformsReadOn", {
            date: format.dateTime(utcDate(oldest), DAY_MONTH_YEAR),
          })}
        </p>
      )}
    </Tile>
  );
}
