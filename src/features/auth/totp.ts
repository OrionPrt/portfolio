import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { encodeBase32UpperCaseNoPadding } from "@oslojs/encoding";

/** RFC 6238 defaults, the ones every authenticator app supports. */
export const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
/** Steps accepted around the current one, for clock drift. */
const TOTP_WINDOW = 1;
/** RFC 4226 recommends 160 bits, the size of an HMAC-SHA-1 key. */
const SECRET_BYTES = 20;

/** An HOTP code (RFC 4226): HMAC-SHA-1 of the counter, dynamically truncated. */
export function generateHotp(
  key: Uint8Array,
  counter: number,
  digits: number = TOTP_DIGITS,
): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(message).digest();
  const offset = (mac.at(-1) ?? 0) & 0x0f;
  const binary = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, "0");
}

function totpStep(time: Date): number {
  return Math.floor(time.getTime() / 1000 / TOTP_PERIOD_SECONDS);
}

/**
 * The time step a TOTP code belongs to, within one step of `now`, or
 * undefined. Every candidate is compared in constant time, without stopping
 * early. The caller must refuse a step already used (replay).
 */
export function matchTotp(
  key: Uint8Array,
  code: string,
  now: Date,
): number | undefined {
  if (!/^\d{6}$/.test(code)) {
    return undefined;
  }
  const current = totpStep(now);
  let matched: number | undefined;
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset++) {
    const step = current + offset;
    const expected = Buffer.from(generateHotp(key, step));
    if (timingSafeEqual(expected, Buffer.from(code)) && matched === undefined) {
      matched = step;
    }
  }
  return matched;
}

export function generateTotpSecret(): Uint8Array {
  return new Uint8Array(randomBytes(SECRET_BYTES));
}

interface TotpUriInput {
  readonly issuer: string;
  readonly account: string;
  readonly secret: Uint8Array;
}

/** The otpauth:// URI authenticator apps read from a QR code (Key Uri Format). */
export function createTotpUri({
  issuer,
  account,
  secret,
}: TotpUriInput): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const parameters = [
    `secret=${encodeBase32UpperCaseNoPadding(secret)}`,
    `issuer=${encodeURIComponent(issuer)}`,
    "algorithm=SHA1",
    `digits=${String(TOTP_DIGITS)}`,
    `period=${String(TOTP_PERIOD_SECONDS)}`,
  ];
  return `otpauth://totp/${label}?${parameters.join("&")}`;
}
