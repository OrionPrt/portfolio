import { useLocale, useTranslations } from "next-intl";
import { ViewTransition } from "react";

import { RichMarkdown } from "@/components/content/rich-markdown";
import { SkillBadge } from "@/components/content/skill-badge";
import { ViewShell } from "@/components/content/view-shell";
import { MediaImage } from "@/components/ui/media-image";
import type { MarkdownOutline } from "@/features/content/markdown-outline";
import { postTransitionName } from "@/features/content/view-names";
import type { MediaById } from "@/features/media/types";
import type { PostSummary, PostView } from "@/features/posts/types";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/locales";

import { PostFacts } from "./post-facts";

/** The posts on either side of this one, by publication day. */
export interface PostNeighbours {
  readonly older: PostSummary | undefined;
  readonly newer: PostSummary | undefined;
}

/**
 * The heading ids' prefix: the other language's copy of the page stays
 * mounted, and "h-" keeps a heading named "Skills" off the page's own ids.
 */
export function postHeadingPrefix(slug: string, locale: Locale): string {
  return `post-${slug}-${locale}-h-`;
}

/** A post with fewer headings has no table of contents. */
const MIN_TOC_HEADINGS = 2;

interface TableOfContentsProps {
  readonly id: string;
  readonly outline: MarkdownOutline;
  readonly lang: string | undefined;
}

/**
 * The `##` and `###` headings, linked: above the text, or beside it on a wide
 * screen, where it stays in view while the text scrolls. Its padding leaves
 * room for the focus ring, which the scrolling box would clip.
 */
function TableOfContents({ id, outline, lang }: TableOfContentsProps) {
  const t = useTranslations("Blog");
  return (
    <nav
      aria-labelledby={id}
      className="flex flex-col gap-3 lg:sticky lg:top-8 lg:-m-2 lg:max-h-[calc(100dvh-4rem)] lg:self-start lg:overflow-y-auto lg:p-2"
    >
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {t("toc")}
      </h2>
      {/* role="list": Safari drops list semantics once list-style is none. */}
      <ol role="list" lang={lang} className="flex flex-col gap-1.5 text-sm">
        {outline.headings.map((heading) => (
          <li key={heading.id} className={heading.depth === 3 ? "pl-4" : ""}>
            <a
              href={`#${heading.id}`}
              className="text-fg-muted hover:text-fg underline-offset-4 hover:underline"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function NeighbourLink({
  post,
  label,
}: {
  readonly post: PostSummary | undefined;
  readonly label: string;
}) {
  if (post === undefined) {
    return null;
  }
  return (
    <Link
      href={{ pathname: "/posts/[slug]", params: { slug: post.slug } }}
      className="border-line rounded-control hover:border-fg-muted flex flex-col gap-1 border p-4"
    >
      <span className="text-fg-muted font-mono text-xs">{label}</span>{" "}
      <span
        lang={post.isFallback ? post.contentLocale : undefined}
        className="font-medium"
      >
        {post.title}
      </span>
    </Link>
  );
}

interface PostDetailProps {
  readonly post: PostView;
  readonly outline: MarkdownOutline;
  readonly neighbours: PostNeighbours;
  /** The library's images its text shows. */
  readonly images?: MediaById;
}

/** A post's page: the latest post's tile morphs into it. */
export function PostDetail({
  post,
  outline,
  neighbours,
  images,
}: PostDetailProps) {
  const t = useTranslations("Blog");
  const locale = useLocale();
  const idPrefix = `post-${post.slug}-${locale}`;
  const lang = post.isFallback ? post.contentLocale : undefined;
  const hasToc = outline.headings.length >= MIN_TOC_HEADINGS;
  const hasNeighbours =
    neighbours.older !== undefined || neighbours.newer !== undefined;

  return (
    <ViewTransition
      name={postTransitionName(post.slug)}
      share="morph"
      default="none"
    >
      <ViewShell
        titleId={`${idPrefix}-title`}
        label={t(`kinds.${post.kind}`)}
        title={post.title}
        lead={post.excerpt}
        lang={lang}
      >
        <PostFacts
          post={post}
          readingMinutes={outline.readingMinutes}
          retiredOn={post.retiredOn}
          locale={locale}
        />
        {post.cover !== undefined && (
          // The page's main image: described, and fetched at once.
          <MediaImage
            image={post.cover}
            sizes="(min-width: 1280px) 1100px, 100vw"
            isPriority
            className="border-line rounded-tile bg-surface-muted max-h-[60vh] w-full border object-contain"
          />
        )}
        <div
          className={
            hasToc
              ? "flex flex-col gap-10 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12"
              : "contents"
          }
        >
          {hasToc && (
            <TableOfContents
              id={`${idPrefix}-toc`}
              outline={outline}
              lang={lang}
            />
          )}
          <div lang={lang} className="max-w-prose min-w-0">
            <RichMarkdown
              source={post.bodyMd}
              topLevel={2}
              images={images}
              headingIdPrefix={postHeadingPrefix(post.slug, locale)}
              locale={post.contentLocale}
            />
          </div>
        </div>
        {post.skills.length > 0 && (
          <section
            aria-labelledby={`${idPrefix}-skills`}
            className="flex flex-col gap-3"
          >
            <h2
              id={`${idPrefix}-skills`}
              className="text-lg font-semibold tracking-tight"
            >
              {t("skills")}
            </h2>
            <ul role="list" className="flex flex-wrap gap-1.5">
              {post.skills.map((skill) => (
                <li key={skill.slug}>
                  <SkillBadge skill={skill} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {hasNeighbours && (
          <nav
            aria-label={t("neighbours")}
            className="grid gap-3 sm:grid-cols-2"
          >
            <NeighbourLink post={neighbours.older} label={t("previous")} />
            <NeighbourLink post={neighbours.newer} label={t("next")} />
          </nav>
        )}
        <Link
          href="/posts"
          className="text-fg-muted hover:text-fg mt-auto self-start font-mono text-xs"
        >
          {t("all")} <span aria-hidden="true">→</span>
        </Link>
      </ViewShell>
    </ViewTransition>
  );
}
