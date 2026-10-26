import { encodeBase32UpperCaseNoPadding } from "@oslojs/encoding";

import { SITE_NAME } from "@/lib/site";
import { ok, type Result } from "@/lib/result";

import type { AuthDependencies } from "./auth-dependencies";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from "./recovery-codes";
import { createTotpUri } from "./totp";

/** How authenticator apps label the account. */
const TOTP_ISSUER = `${SITE_NAME} · admin`;

export interface TotpEnrollment {
  /** otpauth:// URI, shown as a QR code. */
  readonly uri: string;
  /** The same secret, in groups of 4, for typing by hand. */
  readonly secretText: string;
}

/** What the CLI shows to set up an authenticator app. */
export function totpEnrollment(
  secret: Uint8Array,
  email: string,
): TotpEnrollment {
  return {
    uri: createTotpUri({ issuer: TOTP_ISSUER, account: email, secret }),
    secretText: encodeBase32UpperCaseNoPadding(secret).replace(
      /(.{4})(?!$)/g,
      "$1 ",
    ),
  };
}

function hashOf(code: string): string {
  const normalized = normalizeRecoveryCode(code);
  if (normalized === undefined) {
    throw new Error("A generated recovery code is malformed.");
  }
  return hashRecoveryCode(normalized);
}

/** Fresh recovery codes for the account: the old ones stop working. */
export async function issueRecoveryCodes(
  userId: string,
  deps: Pick<AuthDependencies, "recoveryCodes">,
): Promise<Result<readonly string[]>> {
  const codes = generateRecoveryCodes();
  const stored = await deps.recoveryCodes.replace(userId, codes.map(hashOf));
  return stored.ok ? ok(codes) : stored;
}
