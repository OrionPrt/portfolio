import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound, permanentRedirect } from "next/navigation";

import { DataUnavailable } from "@/components/content/data-unavailable";
import {
  PostDetail,
  postHeadingPrefix,
  type PostNeighbours,
} from "@/components/posts/post-detail";
import { JsonLd } from "@/components/seo/json-ld";
import { outlineOf } from "@/features/content/markdown-outline";
import { movedSlug } from "@/features/content/moved-slugs";
import { getMarkdownImages } from "@/features/media/queries";
import { getPublishedPost, getPublishedPosts } from "@/features/posts/queries";
import type { PostSummary } from "@/features/posts/types";
import { localizedAlternates } from "@/features/seo/alternates";
import { postJsonLd } from "@/features/seo/json-ld";
import { siteUrl } from "@/features/seo/site-url";
import type { Locale } from "@/i18n/locales";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { unwrapOr } from "@/lib/result";
import { SITE_NAME } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/posts/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const post = await getPublishedPost(slug, locale);
  // Unknown or unreadable: the page renders not-found or the outage notice.
  if (!post.ok || post.data === undefined) {
    return {};
  }
  return {
    title: post.data.title,
    description: post.data.excerpt,
    alternates: localizedAlternates(locale, {
      pathname: "/posts/[slug]",
      params: { slug },
    }),
  };
}

// Blocking render, like every page (ADR-0002, ADR-0003).
export const instant = false;

/** The posts either side of this one; none when the list cannot be read. */
async function neighboursOf(
  slug: string,
  locale: Locale,
): Promise<PostNeighbours> {
  const posts: readonly PostSummary[] = unwrapOr(
    await getPublishedPosts(locale),
    [],
  );
  const index = posts.findIndex((post) => post.slug === slug);
  return index === -1
    ? { older: undefined, newer: undefined }
    : { older: posts[index + 1], newer: posts[index - 1] };
}

/** The cover's address for search engines: the widest stored width. */
function coverUrl(post: PostSummary): string | undefined {
  const widest = post.cover?.variants.at(-1);
  return widest === undefined ? undefined : new URL(widest.url, siteUrl()).href;
}

export default async function PostPage({
  params,
}: PageProps<"/[locale]/posts/[slug]">) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const post = await getPublishedPost(slug, locale);
  if (!post.ok) {
    return <DataUnavailable />;
  }
  // The proxy already answered 404 for unknown slugs: this is the soft fallback.
  if (post.data === undefined) {
    // Renamed a moment ago: the proxy's lists have yet to learn it.
    const moved = await movedSlug("posts", slug);
    if (moved !== undefined) {
      permanentRedirect(
        getPathname({
          locale,
          href: { pathname: "/posts/[slug]", params: { slug: moved } },
        }),
      );
    }
    notFound();
  }
  const href = { pathname: "/posts/[slug]", params: { slug } } as const;
  const [images, neighbours] = await Promise.all([
    getMarkdownImages(post.data.bodyMd, locale),
    neighboursOf(slug, locale),
  ]);
  return (
    <>
      <JsonLd
        data={postJsonLd({
          headline: post.data.title,
          description: post.data.excerpt,
          url: new URL(getPathname({ locale, href }), siteUrl()).href,
          language: post.data.contentLocale,
          datePublished: post.data.publishedOn,
          authorName: SITE_NAME,
          keywords: post.data.skills.map((skill) => skill.name),
          image: coverUrl(post.data),
        })}
      />
      <PostDetail
        post={post.data}
        outline={outlineOf(post.data.bodyMd, postHeadingPrefix(slug, locale))}
        neighbours={neighbours}
        images={images}
      />
    </>
  );
}
