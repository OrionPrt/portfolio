import { createHash, randomInt } from "node:crypto";

export const RECOVERY_CODE_COUNT = 10;

// Base32 (RFC 4648), lowercase: no 0, 1, 8 or 9, but o and l remain. The
// codes are meant to be pasted from a password manager, not typed.
const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
/**
 * 24 characters of 5 bits: 120 random bits per code. From 112 bits, ASVS
 * (6.5.2) accepts a plain hash; below, it requires a password hash.
 */
const CODE_LENGTH = 24;
const GROUP_LENGTH = 4;
const NORMALIZED_CODE = /^[a-z2-7]{24}$/;

function generateCode(): string {
  const characters = Array.from(
    { length: CODE_LENGTH },
    () => ALPHABET[randomInt(ALPHABET.length)] ?? "",
  ).join("");
  return Array.from({ length: CODE_LENGTH / GROUP_LENGTH }, (_, group) =>
    characters.slice(group * GROUP_LENGTH, (group + 1) * GROUP_LENGTH),
  ).join("-");
}

/** Codes shown once, as "abcd-efgh-…"; only their hashes are stored. */
export function generateRecoveryCodes(
  count: number = RECOVERY_CODE_COUNT,
): readonly string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(generateCode());
  }
  return [...codes];
}

/** The code as stored: lowercase, without its dash or spaces; undefined if malformed. */
export function normalizeRecoveryCode(input: string): string | undefined {
  const compact = input.toLowerCase().replace(/[\s-]/g, "");
  return NORMALIZED_CODE.test(compact) ? compact : undefined;
}

/** 120 random bits make a plain SHA-256 enough: nothing to guess or try. */
export function hashRecoveryCode(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}
