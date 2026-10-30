import {
  tileContent,
  type HubContent,
  type TileContent,
} from "@/features/bento/tile-content";
import type { TileView } from "@/features/catalog/repository";
import type { TileSize } from "@/features/content/vocabulary";

import { BentoGrid } from "./bento-grid";
import { ContactTile } from "./tiles/contact-tile";
import { ExperienceTile } from "./tiles/experience-tile";
import { FeaturedProjectTile } from "./tiles/featured-project-tile";
import { IdentityTile } from "./tiles/identity-tile";
import { JourneyTile } from "./tiles/journey-tile";
import { LatestPostTile } from "./tiles/latest-post-tile";
import { LinksTile } from "./tiles/links-tile";
import { StackTile } from "./tiles/stack-tile";

export interface HubData extends HubContent {
  readonly tiles: readonly TileView[];
}

const IDENTITY_TILE: TileView = { kind: "identity", size: "xl" };

/** The layout when bento_tiles cannot be read: who I am, what I do, how to reach me. */
export const FALLBACK_TILES: readonly TileView[] = [
  IDENTITY_TILE,
  { kind: "stack", size: "md" },
  { kind: "contact", size: "sm" },
];

interface ShownTileProps {
  readonly size: TileSize;
  readonly content: TileContent;
}

function ShownTile({ size, content }: ShownTileProps) {
  switch (content.kind) {
    case "identity":
      return <IdentityTile size={size} profile={content.profile} />;
    case "featured_project":
      return <FeaturedProjectTile size={size} project={content.project} />;
    case "current_experience":
      return <ExperienceTile size={size} experience={content.experience} />;
    case "stack":
      return <StackTile size={size} skills={content.skills} />;
    case "cyber_stats":
      return <LinksTile size={size} kind="platforms" links={content.links} />;
    case "certifications":
      return (
        <JourneyTile
          size={size}
          education={content.education}
          certifications={content.certifications}
        />
      );
    case "contact":
      return <ContactTile size={size} links={content.links} />;
    case "latest_post":
      return <LatestPostTile size={size} post={content.post} />;
  }
}

interface HubTileProps {
  readonly tile: TileView;
  readonly data: HubData;
}

/** One tile of the configured layout; a tile without content renders nothing. */
function HubTile({ tile: { kind, size }, data }: HubTileProps) {
  const content = tileContent(kind, data);
  return content === undefined ? null : (
    <ShownTile size={size} content={content} />
  );
}

interface BentoHubProps {
  readonly data: HubData;
}

/**
 * The home hub: the tiles of bento_tiles, in their order and sizes. The
 * identity tile holds the page's h1, so it is shown even if left out.
 */
export function BentoHub({ data }: BentoHubProps) {
  const tiles = data.tiles.some((tile) => tile.kind === "identity")
    ? data.tiles
    : [IDENTITY_TILE, ...data.tiles];

  return (
    <BentoGrid>
      {tiles.map((tile) => (
        <HubTile key={tile.kind} tile={tile} data={data} />
      ))}
    </BentoGrid>
  );
}
