import { createHash, timingSafeEqual } from "node:crypto";

/** As the env schema requires (src/lib/env.ts): a shorter one is not used. */
const MIN_SECRET_LENGTH = 32;

/** CRON_SECRET, read alone: a cron call never depends on the other variables. */
export function cronSecretOf(
  env: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const secret = env.CRON_SECRET;
  return secret !== undefined && secret.length >= MIN_SECRET_LENGTH
    ? secret
    : undefined;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Vercel calls its crons with `Authorization: Bearer <CRON_SECRET>`. Compared
 * in constant time, digests first: their length tells nothing either.
 */
export function isCronRequest(
  authorization: string | null,
  secret: string,
): boolean {
  return (
    authorization !== null &&
    timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`))
  );
}
