import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { parseClientEnv, parseServerEnv } from "./src/lib/env";
import { SECURITY_HEADERS } from "./src/lib/security-headers";

// Fail fast: an invalid environment aborts `next dev` and `next build` before anything runs.
parseServerEnv(process.env);
parseClientEnv(process.env);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    // The largest form is the admin's profile: two Markdown texts of 50,000
    // characters at most (French, English), a few hundred KB of UTF-8 at
    // worst. Zod bounds every field; anything bigger is refused unread
    // (default 1 MB). The public contact form stays near 35 KB.
    serverActions: { bodySizeLimit: "512kb" },
  },
  headers: () =>
    Promise.resolve([
      { source: "/:path*", headers: [...SECURITY_HEADERS] },
      // Never indexed, whatever the site's launch state.
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ]),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
