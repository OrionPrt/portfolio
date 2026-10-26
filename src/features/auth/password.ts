import "server-only";

import { hash, verify, type Options } from "@node-rs/argon2";

import { err, ok, type Result } from "@/lib/result";

import type { PasswordProblem } from "./vocabulary";

/**
 * In characters. ASVS strongly recommends at least 15, with no composition
 * rules; the ceiling bounds the work an anonymous request can cause.
 */
export const PASSWORD_LIMITS = { min: 15, max: 128 } as const;

/**
 * argon2id with the OWASP Password Storage Cheat Sheet's first set of
 * parameters: 19 MiB, 2 passes, 1 lane. Argon2id is the library's default
 * algorithm (its enum is an ambient const enum, unreadable under isolated
 * modules); a test pins the "$argon2id$" prefix of the hashes it produces.
 */
const ARGON2_OPTIONS: Options = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

/** One form per password: the same characters typed on any keyboard match. */
function normalized(password: string): string {
  return password.normalize("NFC");
}

const graphemes = new Intl.Segmenter();

/** Characters as people count them: an emoji or an accented letter is one. */
function characterCount(text: string): number {
  return Array.from(graphemes.segment(text)).length;
}

/**
 * Words anyone who knows the site would try first (ASVS 6.1.2): its name,
 * its owner's, what it is. The account's email, and the part before its @,
 * are refused as well.
 */
export const CONTEXT_WORDS: readonly string[] = [
  "orion",
  "prieto",
  "portfolio",
];

/** The email's local part is only refused from 4 characters: shorter ones match too much. */
const MIN_LOCAL_PART = 4;

function containsContextWord(password: string, email: string): boolean {
  const text = normalized(password).toLowerCase();
  const address = email.trim().toLowerCase();
  const localPart = address.split("@")[0] ?? "";
  const words = [
    ...CONTEXT_WORDS,
    address,
    ...(localPart.length >= MIN_LOCAL_PART ? [localPart] : []),
  ];
  return words.some((word) => word !== "" && text.includes(word));
}

export function checkPasswordPolicy(
  password: string,
  email: string,
): Result<void, PasswordProblem> {
  const length = characterCount(normalized(password));
  if (length < PASSWORD_LIMITS.min) {
    return err("too_short");
  }
  if (length > PASSWORD_LIMITS.max) {
    return err("too_long");
  }
  if (containsContextWord(password, email)) {
    return err("contains_context_word");
  }
  return ok(undefined);
}

export function hashPassword(password: string): Promise<string> {
  return hash(normalized(password), ARGON2_OPTIONS);
}

/** False on a mismatch, and on a hash the library cannot read. */
export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, normalized(password));
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * The same work as a real check, for an email that matches no account: the
 * response time does not tell whether the account exists. Always false.
 */
export async function verifyDummyPassword(password: string): Promise<false> {
  dummyHash ??= hashPassword("dummy password, never a real one");
  await verifyPassword(await dummyHash, password);
  return false;
}
