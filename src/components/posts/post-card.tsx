import { useLocale } from "next-intl";

import { TileLink } from "@/components/bento/tile";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { CHIP_CLASSES } from "@/components/ui/chip-classes";
import { MediaImage } from "@/components/ui/media-image";
import type { PostSummary } from "@/features/posts/types";

import { PostFacts } from "./post-facts";

interface PostCardProps {
  readonly post: PostSummary;
}

/** A post in the list: its title links to the post. */
export function PostCard({ post }: PostCardProps) {
  const locale = useLocale();
  const titleId = `post-card-${post.slug}-${locale}`;
  const lang = post.isFallback ? post.contentLocale : undefined;

  return (
    <article
      aria-labelledby={titleId}
      className="group bg-surface border-line rounded-tile hover:border-fg-muted has-focus-visible:outline-focus relative flex h-full flex-col gap-3 border p-6 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-3"
    >
      {post.cover !== undefined && (
        // The title below says what it is: the cover adorns it.
        <div className="border-line -mx-6 -mt-6 mb-1 overflow-hidden rounded-t-[inherit] border-b">
          <MediaImage
            image={post.cover}
            alt=""
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="aspect-[16/9] w-full object-cover"
          />
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <PostFacts post={post} locale={locale} />
        <span className="text-fg-muted">
          <ArrowIcon />
        </span>
      </div>
      <h2
        id={titleId}
        lang={lang}
        className="text-xl font-semibold tracking-tight"
      >
        <TileLink
          href={{ pathname: "/posts/[slug]", params: { slug: post.slug } }}
        >
          {post.title}
        </TileLink>
      </h2>
      <p lang={lang} className="text-fg-muted leading-relaxed">
        {post.excerpt}
      </p>
      {post.skills.length > 0 && (
        <ul role="list" className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {post.skills.map((skill) => (
            <li key={skill.slug} className={CHIP_CLASSES}>
              {skill.name}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
