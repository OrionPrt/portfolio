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
    // The contact form is the only action. A 5,000-character message, its
    // Turnstile token and the previous state useActionState sends back (the
    // values echoed after a refusal) stay near 35 KB at worst (default 1 MB).
    serverActions: { bodySizeLimit: "64kb" },
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
