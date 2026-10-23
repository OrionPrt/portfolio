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
  headers: () =>
    Promise.resolve([{ source: "/:path*", headers: [...SECURITY_HEADERS] }]),
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
