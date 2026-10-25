interface RateLimiterOptions {
  /** Requests allowed per key within one window. */
  readonly limit: number;
  readonly windowMs: number;
  /** Bounds memory: while this many keys are tracked, unseen keys are refused. */
  readonly maxKeys: number;
  readonly now?: () => number;
}

export interface RateLimiter {
  /** Counts one request for the key; false when the key is over its limit. */
  readonly allow: (key: string) => boolean;
}

interface Bucket {
  readonly startedAt: number;
  readonly count: number;
}

/**
 * A fixed-window limiter kept in memory, so per server instance: a best-effort
 * guard for endpoints whose abuse is only noise (CSP reports). Endpoints that
 * must hold across instances use a shared store (P4).
 */
export function createRateLimiter({
  limit,
  windowMs,
  maxKeys,
  now = Date.now,
}: RateLimiterOptions): RateLimiter {
  const buckets = new Map<string, Bucket>();

  const prune = (time: number): void => {
    for (const [key, bucket] of buckets) {
      if (time - bucket.startedAt >= windowMs) {
        buckets.delete(key);
      }
    }
  };

  return {
    allow: (key) => {
      const time = now();
      const current = buckets.get(key);
      if (current !== undefined && time - current.startedAt < windowMs) {
        buckets.set(key, { ...current, count: current.count + 1 });
        return current.count < limit;
      }
      if (current === undefined && buckets.size >= maxKeys) {
        prune(time);
        if (buckets.size >= maxKeys) {
          return false;
        }
      }
      buckets.set(key, { startedAt: time, count: 1 });
      return limit > 0;
    },
  };
}
