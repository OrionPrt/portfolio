import {
  prepareNewPassword,
  setPassword,
  type SetPasswordProblem,
} from "@/features/auth/admin-cli";
import { isBreachedPassword } from "@/features/auth/breached-passwords";
import { PASSWORD_LIMITS } from "@/features/auth/password";

import { fail, runWithDatabase } from "../db/connect";
import { ask, askHidden } from "./prompt";

const PROBLEMS: Readonly<Record<SetPasswordProblem, string>> = {
  unknown_account: "no admin account has this email.",
  invalid_email: "this is not an email address.",
  too_short: `the password needs ${String(PASSWORD_LIMITS.min)} characters or more.`,
  too_long: `the password cannot exceed ${String(PASSWORD_LIMITS.max)} characters.`,
  contains_context_word:
    "the password cannot contain the email address, nor the site's or its owner's name.",
  breached: "this password appears in known data breaches: choose another one.",
  unavailable: "the database could not be read or written.",
};

/**
 * Break-glass, when the password is forgotten or leaked (whoever holds it
 * can keep the second factor locked, and the web asks for a code to change
 * it): sets a new one, ends every session and lifts every lock. Needs
 * database access, a stronger proof than the password itself.
 */
async function main(): Promise<void> {
  const email = await ask("Admin email: ");
  const password = await askHidden(
    `New password (${String(PASSWORD_LIMITS.min)} characters or more, a passphrase is fine): `,
  );
  if ((await askHidden("New password again: ")) !== password) {
    fail("admin:set-password: the two passwords differ.");
    return;
  }
  await runWithDatabase("admin:set-password", async ({ db }) => {
    const prepared = await prepareNewPassword(
      db,
      { email, password },
      { isBreached: (candidate: string) => isBreachedPassword(candidate) },
    );
    if (!prepared.ok) {
      throw new Error(PROBLEMS[prepared.error]);
    }
    const ended = await setPassword(db, prepared.data);
    if (!ended.ok) {
      throw new Error(PROBLEMS.unavailable);
    }
    const warning =
      prepared.data.breachCheck === "unavailable"
        ? " The breached-password check could not be reached."
        : "";
    return `password set for ${prepared.data.user.email}; ${String(ended.data)} session(s) ended, every lock lifted.${warning}`;
  });
}

main().catch((error: unknown) => {
  fail(
    `admin:set-password: ${error instanceof Error ? error.message : String(error)}`,
  );
});
