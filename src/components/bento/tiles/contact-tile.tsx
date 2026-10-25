import { useTranslations } from "next-intl";
import { ViewTransition } from "react";

import { ArrowIcon } from "@/components/ui/arrow-icon";
import { BUTTON_CLASSES } from "@/components/ui/button-classes";
import { VIEW_TRANSITIONS } from "@/features/content/view-names";
import type { TileSize } from "@/features/content/vocabulary";
import type { SocialLinkView } from "@/features/profile/repository";
import { Link } from "@/i18n/navigation";

import { LinksTile } from "./links-tile";

interface ContactTileProps {
  readonly size: TileSize;
  readonly links: readonly SocialLinkView[];
}

/** How to reach me: the form first, then the links. Morphs into the contact page. */
export function ContactTile({ size, links }: ContactTileProps) {
  const t = useTranslations("Home");

  return (
    <ViewTransition
      name={VIEW_TRANSITIONS.contact}
      share="morph"
      default="none"
    >
      <LinksTile
        size={size}
        kind="contact"
        links={links}
        lead={t("contactLead")}
        action={
          <Link
            href="/contact"
            prefetch
            className={`${BUTTON_CLASSES.primary} group self-start`}
          >
            {t("writeMessage")}
            <ArrowIcon />
          </Link>
        }
      />
    </ViewTransition>
  );
}
