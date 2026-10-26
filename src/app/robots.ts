import type { MetadataRoute } from "next";

import { siteUrl } from "@/features/seo/site-url";
import { IS_INDEXABLE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (!IS_INDEXABLE) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    // The admin also says noindex (X-Robots-Tag): this only spares the crawl.
    rules: { userAgent: "*", allow: "/", disallow: "/admin" },
    sitemap: new URL("/sitemap.xml", siteUrl()).href,
  };
}
