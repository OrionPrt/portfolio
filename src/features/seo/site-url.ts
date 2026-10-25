import { parseClientEnv, parseServerEnv } from "@/lib/env";

type EnvSource = Readonly<Record<string, string | undefined>>;

const LOCAL_ORIGIN = "http://localhost:3000";

/**
 * The absolute base of canonical URLs, hreflang links and the sitemap: the
 * configured public origin, else Vercel's production domain. Never derived
 * from request headers, which a client controls (Host, X-Forwarded-Host).
 */
export function siteUrl(env: EnvSource = process.env): URL {
  const { NEXT_PUBLIC_SITE_URL } = parseClientEnv({
    NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
  });
  if (NEXT_PUBLIC_SITE_URL !== undefined) {
    return new URL(NEXT_PUBLIC_SITE_URL);
  }
  const { VERCEL_PROJECT_PRODUCTION_URL } = parseServerEnv(env);
  return new URL(
    VERCEL_PROJECT_PRODUCTION_URL === undefined
      ? LOCAL_ORIGIN
      : `https://${VERCEL_PROJECT_PRODUCTION_URL}`,
  );
}
