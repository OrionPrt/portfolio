import {
  prepareSecondFactorReset,
  resetSecondFactor,
} from "@/features/auth/admin-cli";

import { fail, runWithDatabase } from "../db/connect";
import {
  askFirstCode,
  sealingKeyOrReason,
  showEnrollment,
  showRecoveryCodes,
} from "./enroll";
import { ask } from "./prompt";

/**
 * Break-glass, when both the phone and the recovery codes are lost: sets up a
 * new authenticator, which replaces the second factor and its recovery codes,
 * and ends every session. Needs database access, a stronger proof than the
 * second factor itself.
 */
async function main(): Promise<void> {
  const sealing = sealingKeyOrReason();
  if ("reason" in sealing) {
    fail(`admin:reset-totp: ${sealing.reason}`);
    return;
  }
  const email = await ask("Admin email: ");
  await runWithDatabase("admin:reset-totp", async ({ db }) => {
    const prepared = await prepareSecondFactorReset(db, email);
    if (!prepared.ok) {
      throw new Error("the database could not be read.");
    }
    if (prepared.data === undefined) {
      throw new Error("no admin account has this email.");
    }
    showEnrollment(prepared.data.enrollment);
    const { user, secret } = prepared.data;
    const reset = await askFirstCode((code) =>
      resetSecondFactor(db, { user, secret }, code, {
        sealingKey: sealing.key,
        now: new Date(),
      }),
    );
    if (!reset.ok) {
      throw new Error(
        reset.error === "code_refused"
          ? "no code matched: nothing changed."
          : "the database could not be written.",
      );
    }
    showRecoveryCodes(reset.data);
    return "second factor replaced; every session was ended.";
  });
}

main().catch((error: unknown) => {
  fail(
    `admin:reset-totp: ${error instanceof Error ? error.message : String(error)}`,
  );
});
