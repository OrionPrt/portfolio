import { isIP } from "node:net";

/** The value when it is an IP address, else undefined: a header is only a hint. */
function address(value: string | null | undefined): string | undefined {
  const candidate = value?.trim();
  return candidate !== undefined && isIP(candidate) !== 0
    ? candidate
    : undefined;
}

/**
 * The client's address as seen by the platform. On Vercel, X-Forwarded-For is
 * set by the edge (its first entry is the client); elsewhere it is only a
 * hint, which is enough for best-effort rate limiting. Anything that is not
 * an IP address counts as "unknown", so a forged header cannot grow a key.
 */
export function clientIp(headers: Headers): string {
  return (
    address(headers.get("x-forwarded-for")?.split(",")[0]) ??
    address(headers.get("x-real-ip")) ??
    "unknown"
  );
}
