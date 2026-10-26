import { renderUnicodeCompact } from "uqr";

import { cliSealingKey } from "@/features/auth/admin-cli";
import type { TotpEnrollment } from "@/features/auth/enrollment";
import { parseServerEnv } from "@/lib/env";

import { ask } from "./prompt";

/** Tries for the first code before giving up (nothing is stored meanwhile). */
const CODE_TRIES = 3;

/** The sealing key for DATABASE_URL, or the reason to stop. */
export function sealingKeyOrReason(): { key: Uint8Array } | { reason: string } {
  const env = parseServerEnv(process.env);
  const key = cliSealingKey(env.DATABASE_URL ?? "", env.TOTP_ENCRYPTION_KEY);
  if (key.ok) {
    return { key: key.data };
  }
  return {
    reason:
      key.error === "missing"
        ? "TOTP_ENCRYPTION_KEY must be set (the same value as on Vercel) to seal the second factor."
        : "the development TOTP_ENCRYPTION_KEY cannot seal a production second factor.",
  };
}

/** Shows the authenticator setup: a QR code in the terminal, and the key in text. */
export function showEnrollment({ uri, secretText }: TotpEnrollment): void {
  process.stdout.write(
    [
      "",
      "Scan this QR code with an authenticator app (Aegis, 2FAS, Google Authenticator…):",
      "",
      renderUnicodeCompact(uri, { invert: true }),
      "",
      `Or type this key by hand: ${secretText}`,
      "",
    ].join("\n"),
  );
}

/** Asks for the app's first code until one is accepted, a few times at most. */
export async function askFirstCode<T>(
  check: (
    code: string,
  ) => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let last: { ok: true; data: T } | { ok: false; error: string } = {
    ok: false,
    error: "code_refused",
  };
  for (let attempt = 1; attempt <= CODE_TRIES; attempt++) {
    last = await check(await ask("The 6-digit code the app shows: "));
    if (last.ok || last.error !== "code_refused") {
      return last;
    }
    process.stdout.write("That code does not match. Try the next one.\n");
  }
  return last;
}

/** The recovery codes, printed once: the database only keeps their hashes. */
export function showRecoveryCodes(codes: readonly string[]): void {
  process.stdout.write(
    [
      "",
      "Recovery codes, shown once: store them in a password manager. Each one signs in once without the phone.",
      "",
      ...codes.map((code) => `  ${code}`),
      "",
    ].join("\n"),
  );
}
