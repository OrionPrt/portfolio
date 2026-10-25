import { useLocale, useTranslations } from "next-intl";

import { Eyebrow } from "@/components/ui/eyebrow";
import type { TileSize } from "@/features/content/vocabulary";
import type { SocialLinkView } from "@/features/profile/repository";

import { Tile } from "../tile";

interface LinksTileProps {
  readonly size: TileSize;
  /** Tile kind: scopes the heading id and picks the label. */
  readonly kind: "contact" | "platforms";
  readonly links: readonly SocialLinkView[];
  readonly lead?: string;
}

/** Outbound links: how to reach me (contact), where I train (platforms). */
export function LinksTile({ size, kind, links, lead }: LinksTileProps) {
  const t = useTranslations("Home");
  const tKinds = useTranslations("SocialKinds");
  const locale = useLocale();
  const titleId = `${kind}-title-${locale}`;

  return (
    <Tile size={size} labelledBy={titleId} className="justify-between">
      <Eyebrow as="h2" id={titleId}>
        {t(kind)}
      </Eyebrow>
      {lead !== undefined && <p className="font-medium">{lead}</p>}
      <ul className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-xs">
        {links.map((link) => (
          <li key={link.kind}>
            <a
              href={link.url}
              rel={link.kind === "email" ? undefined : "noopener noreferrer"}
              className="text-fg-muted hover:text-fg inline-flex min-h-6 items-center underline underline-offset-4"
            >
              {tKinds(link.kind)}
            </a>
          </li>
        ))}
      </ul>
    </Tile>
  );
}
