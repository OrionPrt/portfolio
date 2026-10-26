import { ok, type Result } from "@/lib/result";

import type { AuthDependencies } from "./auth-dependencies";
import { openSecret } from "./secret-box";
import { matchTotp } from "./totp";
import type { AdminUserRecord } from "./users-repository";

/** A code as typed or pasted: apps show "123 456". */
export function compactCode(code: string): string {
  return code.replace(/\s/g, "");
}

/** The account's TOTP secret, opened with the sealing key; undefined if absent. */
export function openTotpSecret(
  user: AdminUserRecord,
  sealingKey: Uint8Array,
): Uint8Array | undefined {
  if (user.totpSecret === null) {
    return undefined;
  }
  const opened = openSecret(user.totpSecret, sealingKey, user.id);
  return opened.ok ? opened.data : undefined;
}

/**
 * Checks a code from the account's authenticator: within one step of now,
 * and newer than the last step accepted, recorded in the same statement.
 */
export async function acceptTotpCode(
  user: AdminUserRecord,
  code: string,
  deps: Pick<AuthDependencies, "sealingKey" | "users" | "now">,
): Promise<Result<boolean>> {
  const secret =
    user.totpEnabledAt === null
      ? undefined
      : openTotpSecret(user, deps.sealingKey);
  const step =
    secret === undefined
      ? undefined
      : matchTotp(secret, compactCode(code), deps.now());
  if (step === undefined) {
    return ok(false);
  }
  return deps.users.acceptTotpStep(user.id, step);
}
