import { useLocale, useTranslations } from "next-intl";
import { ViewTransition } from "react";

import { BUTTON_CLASSES } from "@/components/ui/button-classes";
import { VIEW_TRANSITIONS } from "@/features/content/view-names";
import type { TileSize } from "@/features/content/vocabulary";
import type { ProfileView } from "@/features/profile/repository";
import { Link } from "@/i18n/navigation";
import { SITE_NAME } from "@/lib/site";

import { Tile } from "../tile";

interface IdentityTileProps {
  readonly size: TileSize;
  /** Undefined until the profile is seeded, or while the database is down. */
  readonly profile: ProfileView | undefined;
}

/** Who and what: the page's h1. Morphs into the about page. */
export function IdentityTile({ size, profile }: IdentityTileProps) {
  const t = useTranslations("Home");
  const locale = useLocale();
  const titleId = `identity-title-${locale}`;
  const email = profile?.socialLinks.find((link) => link.kind === "email");
  const lang = profile?.isFallback === true ? profile.contentLocale : undefined;

  return (
    <ViewTransition
      name={VIEW_TRANSITIONS.identity}
      share="morph"
      default="none"
    >
      <Tile
        size={size}
        labelledBy={titleId}
        className="justify-between gap-6 p-7"
      >
        <div className="flex flex-col gap-4">
          {profile !== undefined && (
            <p
              lang={lang}
              className="text-accent font-mono text-xs tracking-wide"
            >
              <span aria-hidden="true">● </span>
              {profile.availability}
            </p>
          )}
          <h1
            id={titleId}
            className="text-[clamp(44px,5vw,80px)] leading-[0.95] font-semibold tracking-[-0.05em]"
          >
            {profile?.displayName ?? SITE_NAME}
          </h1>
          <p
            lang={lang}
            className="text-[clamp(19px,1.8vw,24px)] leading-snug font-medium tracking-tight"
          >
            {profile?.headline ?? t("fallbackHeadline")}
          </p>
          {profile !== undefined && (
            <p
              lang={lang}
              className="text-fg-muted max-w-[48ch] leading-relaxed"
            >
              {profile.pitch}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/about" prefetch className={BUTTON_CLASSES.primary}>
            {t("about")}
          </Link>
          {email !== undefined && (
            <a href={email.url} className={BUTTON_CLASSES.secondary}>
              {t("contactMe")}
            </a>
          )}
        </div>
      </Tile>
    </ViewTransition>
  );
}
