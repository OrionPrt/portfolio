import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rate-limit";

import type { UpstashConfig } from "./config";

/** Messages per hour: per sender (hashed network), and from everyone at once. */
export const CONTACT_RATE_LIMIT = {
  limit: 5,
  overall: 30,
  windowMs: 60 * 60 * 1000,
} as const;

/** The key every message counts against, whoever sends it. */
const OVERALL_KEY = "all";

/** Past this, Upstash counts as unavailable and the message goes through. */
const UPSTASH_TIMEOUT_MS = 2000;

export interface ContactRateLimiter {
  /** Counts one message for the key; false when the sender is over the limit. */
  readonly allow: (key: string) => Promise<boolean>;
}

/**
 * The sender's limit first, then the overall one, which caps a flood spread
 * over many addresses (and the mail it would send). Only messages within the
 * sender's limit count against the overall one.
 */
function bothLimits(
  check: (scope: "sender" | "overall", key: string) => Promise<boolean>,
): ContactRateLimiter {
  return {
    allow: async (key) => {
      if (!(await check("sender", key))) {
        return false;
      }
      const isAllowed = await check("overall", OVERALL_KEY);
      if (!isAllowed) {
        logger.warn("contact.overall_limit_reached");
      }
      return isAllowed;
    },
  };
}

function upstashLimiter({ url, token }: UpstashConfig): ContactRateLimiter {
  const redis = new Redis({ url, token });
  const limiters = {
    sender: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(CONTACT_RATE_LIMIT.limit, "1 h"),
      prefix: "contact",
      timeout: UPSTASH_TIMEOUT_MS,
    }),
    overall: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(CONTACT_RATE_LIMIT.overall, "1 h"),
      prefix: "contact:overall",
      timeout: UPSTASH_TIMEOUT_MS,
    }),
  };
  return bothLimits(async (scope, key) => {
    // Fails open, logged: Turnstile already stopped the bots, and losing a
    // real message is worse than letting a few more through. A timeout
    // resolves as a success, so it is checked as well as a failure.
    try {
      const { success, reason } = await limiters[scope].limit(key);
      if (reason === "timeout") {
        logger.error("contact.rate_limit_unavailable", { scope, reason });
      }
      return success;
    } catch (error) {
      logger.error("contact.rate_limit_unavailable", { scope, error });
      return true;
    }
  });
}

/**
 * Upstash, shared by every instance, in production; in memory, per instance,
 * when it is not configured (development, CI).
 */
export function createContactRateLimiter(
  upstash: UpstashConfig | undefined,
): ContactRateLimiter {
  if (upstash !== undefined) {
    return upstashLimiter(upstash);
  }
  const limiters = {
    sender: createRateLimiter({
      limit: CONTACT_RATE_LIMIT.limit,
      windowMs: CONTACT_RATE_LIMIT.windowMs,
      maxKeys: 10_000,
    }),
    overall: createRateLimiter({
      limit: CONTACT_RATE_LIMIT.overall,
      windowMs: CONTACT_RATE_LIMIT.windowMs,
      maxKeys: 1,
    }),
  };
  return bothLimits((scope, key) =>
    Promise.resolve(limiters[scope].allow(key)),
  );
}
