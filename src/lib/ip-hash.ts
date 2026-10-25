import { createHmac } from "node:crypto";

/**
 * A keyed hash of an IP address (HMAC-SHA-256): equal addresses stay
 * comparable for rate limiting and abuse review, but the address cannot be
 * recovered, nor a guess checked, without the secret salt.
 */
export function hashIp(ip: string, salt: string): string {
  return createHmac("sha256", salt).update(ip).digest("hex");
}
