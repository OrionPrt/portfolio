import { useFormatter, useLocale, useTranslations } from "next-intl";
import { ViewTransition } from "react";

import { ArrowIcon } from "@/components/ui/arrow-icon";
import { Eyebrow } from "@/components/ui/eyebrow";
import { postTransitionName } from "@/features/content/view-names";
import type { TileSize } from "@/features/content/vocabulary";
import type { PostSummary } from "@/features/posts/types";
import { DAY_MONTH_YEAR, utcDate } from "@/lib/dates";

import { Tile, TileLink } from "../tile";

interface LatestPostTileProps {
  readonly size: TileSize;
  readonly post: PostSummary;
}

/** The latest article or write-up. Morphs into its page. */
export function LatestPostTile({ size, post }: LatestPostTileProps) {
  const t = useTranslations("Home");
  const tBlog = useTranslations("Blog");
  const format = useFormatter();
  const locale = useLocale();
  const titleId = `latest-post-${post.slug}-title-${locale}`;
  const lang = post.isFallback ? post.contentLocale : undefined;

  return (
    <ViewTransition
      name={postTransitionName(post.slug)}
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
          <Eyebrow>{t("latestPost")}</Eyebrow>
          <ArrowIcon />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2
            id={titleId}
            lang={lang}
            className="line-clamp-3 text-xl font-semibold tracking-tight"
          >
            <TileLink
              href={{ pathname: "/posts/[slug]", params: { slug: post.slug } }}
            >
              {post.title}
            </TileLink>
          </h2>
          <p className="text-fg-muted text-sm">
            {tBlog(`kinds.${post.kind}`)}
            {" · "}
            <time dateTime={post.publishedOn}>
              {format.dateTime(utcDate(post.publishedOn), DAY_MONTH_YEAR)}
            </time>
          </p>
        </div>
      </Tile>
    </ViewTransition>
  );
}
