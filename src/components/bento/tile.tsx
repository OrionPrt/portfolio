import type { ComponentProps, ReactNode } from "react";

import type { TileSize } from "@/features/content/vocabulary";
import { Link } from "@/i18n/navigation";

// Spans on the grid: 1 column on phones, 2 on tablets, 4 from 1024 px.
const SIZE_CLASSES: Readonly<Record<TileSize, string>> = {
  sm: "",
  md: "sm:col-span-2",
  lg: "lg:row-span-2",
  xl: "sm:col-span-2 lg:row-span-2",
};

const INTERACTIVE_CLASSES =
  "group hover:border-fg-muted has-focus-visible:outline-focus transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-3";

interface TileProps {
  readonly size: TileSize;
  readonly labelledBy: string;
  /** Opens a full-screen view: the whole card reacts, through a TileLink. */
  readonly isInteractive?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Tile({
  size,
  labelledBy,
  isInteractive = false,
  className = "",
  children,
}: TileProps) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={`bg-surface border-line rounded-tile relative flex min-w-0 flex-col gap-3 border p-5 ${SIZE_CLASSES[size]} ${isInteractive ? INTERACTIVE_CLASSES : ""} ${className}`}
    >
      {children}
    </section>
  );
}

type TileLinkProps = Pick<ComponentProps<typeof Link>, "href" | "children">;

/**
 * Stretched link: the title is the link, and its ::after covers the tile. The
 * whole card is clickable while the link's name stays its visible text.
 * Prefetched, so the view renders in the same commit and the morph plays.
 */
export function TileLink({ href, children }: TileLinkProps) {
  return (
    <Link
      href={href}
      prefetch
      className="after:rounded-tile outline-none after:absolute after:inset-0"
    >
      {children}
    </Link>
  );
}
