import type { MetadataRoute } from "next";

import { getPublishedExperienceSlugs } from "@/features/experiences/queries";
import { getPublishedPostSlugs } from "@/features/posts/queries";
import { getPublishedProjectSlugs } from "@/features/projects/queries";
import { siteUrl } from "@/features/seo/site-url";
import { sitemapEntries } from "@/features/seo/sitemap-entries";
import { unwrapOr } from "@/lib/result";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projects, experiences, posts] = await Promise.all([
    getPublishedProjectSlugs(),
    getPublishedExperienceSlugs(),
    getPublishedPostSlugs(),
  ]);
  return sitemapEntries(siteUrl(), {
    projects: unwrapOr(projects, []),
    experiences: unwrapOr(experiences, []),
    posts: unwrapOr(posts, []),
  });
}
