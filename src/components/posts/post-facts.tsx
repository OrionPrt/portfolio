import { useFormatter, useTranslations } from "next-intl";

import { CHIP_CLASSES, CHIP_SHAPE } from "@/components/ui/chip-classes";
import type { PostKind } from "@/features/content/vocabulary";
import type { PostSummary } from "@/features/posts/types";
import { DAY_MONTH_YEAR, utcDate } from "@/lib/dates";

/** A write-up's kind in the accent: it tells a solved challenge from an essay. */
const KIND_CLASSES: Readonly<Record<PostKind, string>> = {
  article: CHIP_CLASSES,
  writeup: `border-accent/50 bg-surface-muted text-accent ${CHIP_SHAPE}`,
};

interface PostFactsProps {
  readonly post: PostSummary;
  /** Shown on the post's own page, which reads its body. */
  readonly readingMinutes?: number;
  /** A write-up's retirement day, on its own page. */
  readonly retiredOn?: string | null;
  /** The page's language: a post written in another one says so. */
  readonly locale: string;
}

/** What kind of post, from where, when, how long, in which language. */
export function PostFacts({
  post,
  readingMinutes,
  retiredOn,
  locale,
}: PostFactsProps) {
  const t = useTranslations("Blog");
  const format = useFormatter();
  const isElsewhere = !post.locales.some((language) => language === locale);

  return (
    <div className="text-fg-muted flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <span className={KIND_CLASSES[post.kind]}>{t(`kinds.${post.kind}`)}</span>
      {post.platform !== null && (
        <span className="font-mono text-xs">
          {t(`platforms.${post.platform}`)}
          {post.difficulty !== null && (
            <>
              {" · "}
              {t(`difficulties.${post.difficulty}`)}
            </>
          )}
        </span>
      )}
      <time dateTime={post.publishedOn}>
        {format.dateTime(utcDate(post.publishedOn), DAY_MONTH_YEAR)}
      </time>
      {retiredOn !== undefined && retiredOn !== null && (
        <span>
          {t.rich("retiredOn", {
            date: format.dateTime(utcDate(retiredOn), DAY_MONTH_YEAR),
            time: (day) => <time dateTime={retiredOn}>{day}</time>,
          })}
        </span>
      )}
      {readingMinutes !== undefined && (
        <span>{t("readingTime", { minutes: readingMinutes })}</span>
      )}
      {isElsewhere && (
        <span className="font-mono text-xs">
          {t("onlyIn", { language: post.contentLocale })}
        </span>
      )}
    </div>
  );
}
