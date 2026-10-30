import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DataUnavailable } from "@/components/content/data-unavailable";
import { ViewShell } from "@/components/content/view-shell";
import { PostCard } from "@/components/posts/post-card";
import { getPublishedPosts } from "@/features/posts/queries";
import { localizedAlternates } from "@/features/seo/alternates";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/posts">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "Blog" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localizedAlternates(locale, "/posts"),
  };
}

// Blocking render, like every page (ADR-0002, ADR-0003).
export const instant = false;

/**
 * Every published post, the latest first, in the page's language where it
 * has one; a post written only in the other language says so (ADR-0008).
 */
export default async function BlogPage({
  params,
}: PageProps<"/[locale]/posts">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const [t, posts] = await Promise.all([
    getTranslations({ locale, namespace: "Blog" }),
    getPublishedPosts(locale),
  ]);
  const shell = {
    titleId: `blog-title-${locale}`,
    label: t("label"),
    title: t("title"),
    lead: t("description"),
  };
  if (!posts.ok) {
    return (
      <ViewShell {...shell}>
        <DataUnavailable />
      </ViewShell>
    );
  }

  return (
    <ViewShell {...shell}>
      <p className="text-fg-muted font-mono text-xs">
        {t("count", { count: posts.data.length })}
      </p>
      {posts.data.length === 0 ? (
        <p className="text-fg-muted">{t("empty")}</p>
      ) : (
        // role="list": Safari drops list semantics once list-style is none.
        <ul role="list" className="grid gap-3 md:grid-cols-2">
          {posts.data.map((post) => (
            <li key={post.slug}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>
      )}
    </ViewShell>
  );
}
