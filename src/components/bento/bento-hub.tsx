import type {
  CertificationView,
  SkillView,
  TileView,
} from "@/features/catalog/repository";
import type { SocialKind } from "@/features/content/vocabulary";
import type { ExperienceView } from "@/features/experiences/repository";
import type { ProfileView } from "@/features/profile/repository";
import type { ProjectView } from "@/features/projects/types";

import { BentoGrid } from "./bento-grid";
import { CertificationsTile } from "./tiles/certifications-tile";
import { ContactTile } from "./tiles/contact-tile";
import { ExperienceTile } from "./tiles/experience-tile";
import { FeaturedProjectTile } from "./tiles/featured-project-tile";
import { IdentityTile } from "./tiles/identity-tile";
import { LinksTile } from "./tiles/links-tile";
import { StackTile } from "./tiles/stack-tile";

export interface HubData {
  readonly tiles: readonly TileView[];
  readonly profile: ProfileView | undefined;
  readonly featuredProject: ProjectView | undefined;
  readonly currentExperience: ExperienceView | undefined;
  readonly skills: readonly SkillView[];
  readonly certifications: readonly CertificationView[];
}

const IDENTITY_TILE: TileView = { kind: "identity", size: "xl" };

/** The layout when bento_tiles cannot be read: who I am, what I do, how to reach me. */
export const FALLBACK_TILES: readonly TileView[] = [
  IDENTITY_TILE,
  { kind: "stack", size: "md" },
  { kind: "contact", size: "sm" },
];

const PLATFORM_KINDS: readonly SocialKind[] = [
  "hackthebox",
  "rootme",
  "tryhackme",
];
const CONTACT_KINDS: readonly SocialKind[] = [
  "email",
  "linkedin",
  "github",
  "website",
];

interface HubTileProps {
  readonly tile: TileView;
  readonly data: HubData;
}

/** One tile of the configured layout; a tile without content renders nothing. */
function HubTile({ tile: { kind, size }, data }: HubTileProps) {
  const links = data.profile?.socialLinks ?? [];
  const platforms = links.filter((link) => PLATFORM_KINDS.includes(link.kind));
  const contacts = links.filter((link) => CONTACT_KINDS.includes(link.kind));

  switch (kind) {
    case "identity":
      return <IdentityTile size={size} profile={data.profile} />;
    case "featured_project":
      return (
        data.featuredProject !== undefined && (
          <FeaturedProjectTile size={size} project={data.featuredProject} />
        )
      );
    case "current_experience":
      return (
        data.currentExperience !== undefined && (
          <ExperienceTile size={size} experience={data.currentExperience} />
        )
      );
    case "stack":
      return (
        data.skills.length > 0 && <StackTile size={size} skills={data.skills} />
      );
    case "cyber_stats":
      return (
        platforms.length > 0 && (
          <LinksTile size={size} kind="platforms" links={platforms} />
        )
      );
    case "certifications":
      return (
        data.certifications.length > 0 && (
          <CertificationsTile
            size={size}
            certifications={data.certifications}
          />
        )
      );
    case "contact":
      // Always shown: the contact form needs no published link.
      return <ContactTile size={size} links={contacts} />;
    case "latest_post":
    case "cv":
      // The blog (P7) and the generated CV (P9) do not exist yet.
      return null;
  }
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
