import {
  createAdminAccount,
  prepareAdminAccount,
  type CreateAdminProblem,
} from "@/features/auth/admin-cli";
import { isBreachedPassword } from "@/features/auth/breached-passwords";
import { PASSWORD_LIMITS } from "@/features/auth/password";

import { fail, runWithDatabase } from "../db/connect";
import {
  askFirstCode,
  sealingKeyOrReason,
  showEnrollment,
  showRecoveryCodes,
} from "./enroll";
import { ask, askHidden } from "./prompt";

const PROBLEMS: Readonly<Record<CreateAdminProblem | "code_refused", string>> =
  {
    invalid_email: "this is not an email address.",
    too_short: `the password needs ${String(PASSWORD_LIMITS.min)} characters or more.`,
    too_long: `the password cannot exceed ${String(PASSWORD_LIMITS.max)} characters.`,
    contains_context_word:
      "the password cannot contain the email address, nor the site's or its owner's name.",
    breached:
      "this password appears in known data breaches: choose another one.",
    exists: "an admin account already exists (there is only one).",
    unavailable: "the database could not be written.",
    code_refused:
      "no code matched: nothing was created. Run the command again.",
  };

/**
 * Creates the admin account with its second factor already set up: the
 * account never exists without one, so the web only ever asks for a code.
 */
async function main(): Promise<void> {
  const sealing = sealingKeyOrReason();
  if ("reason" in sealing) {
    fail(`admin:create: ${sealing.reason}`);
    return;
  }
  const email = await ask("Admin email: ");
  const password = await askHidden(
    `Password (${String(PASSWORD_LIMITS.min)} characters or more, a passphrase is fine): `,
  );
  if ((await askHidden("Password again: ")) !== password) {
    fail("admin:create: the two passwords differ.");
    return;
  }
  await runWithDatabase("admin:create", async ({ db }) => {
    const prepared = await prepareAdminAccount(
      db,
      { email, password },
      { isBreached: (candidate: string) => isBreachedPassword(candidate) },
    );
    if (!prepared.ok) {
      throw new Error(PROBLEMS[prepared.error]);
    }
    showEnrollment(prepared.data.enrollment);
    const created = await askFirstCode((code) =>
      createAdminAccount(db, prepared.data, code, {
        sealingKey: sealing.key,
        now: new Date(),
      }),
    );
    if (!created.ok) {
      throw new Error(PROBLEMS[created.error as keyof typeof PROBLEMS]);
    }
    showRecoveryCodes(created.data.recoveryCodes);
    const warning =
      prepared.data.breachCheck === "unavailable"
        ? " The breached-password check could not be reached."
        : "";
    return `created ${created.data.user.email}, second factor on.${warning} Sign in at /admin/login.`;
  });
}

main().catch((error: unknown) => {
  fail(
    `admin:create: ${error instanceof Error ? error.message : String(error)}`,
  );
});
