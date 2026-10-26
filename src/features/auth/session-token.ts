import { createHash, randomBytes } from "node:crypto";

import { encodeBase32LowerCaseNoPadding } from "@oslojs/encoding";

/** 256 bits: well beyond ASVS's 128, and the length of the hash that stores it. */
const TOKEN_BYTES = 32;
const TOKEN_FORMAT = /^[a-z2-7]{52}$/;

/** The secret kept in the visitor's cookie, and nowhere else. */
export function generateSessionToken(): string {
  return encodeBase32LowerCaseNoPadding(randomBytes(TOKEN_BYTES));
}

/**
 * The session's id in the database: the SHA-256 of its token. A leaked table
 * gives no usable token, and the token's entropy makes a plain hash enough.
 */
export function sessionIdOf(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Filters out garbage before any hashing or query. */
export function isWellFormedSessionToken(token: string): boolean {
  return TOKEN_FORMAT.test(token);
}
