// How long a cached read that failed is kept: it depends on why it failed.

/**
 * A database that does not answer (an outage): Next's "seconds" profile. Each
 * read is tried again at most once a second per instance, so a crowd during
 * an outage does not pile its queries onto a struggling database.
 */
const OUTAGE_LIFE = { stale: 30, revalidate: 1, expire: 60 } as const;

/**
 * No database at all (a build in CI): nothing kept. With the outage's life, a
 * page prerendered just after another found that page's failure in the shared
 * cache, which its own prerender then missed ("Unexpected cache miss"). Kept
 * by nobody, each failure stays the page's own.
 */
const UNCONFIGURED_LIFE = { stale: 0, revalidate: 0, expire: 0 } as const;

type FailedReadLife = typeof OUTAGE_LIFE | typeof UNCONFIGURED_LIFE;

/** Either way, the failure is left out of prerendered shells (under 5 minutes). */
export function failedReadLife(
  env: Readonly<Record<string, string | undefined>> = process.env,
): FailedReadLife {
  const url = env.DATABASE_URL;
  return url === undefined || url === "" ? UNCONFIGURED_LIFE : OUTAGE_LIFE;
}
