import { appRoleUrl, ensureAppRole, isUsablePassword } from "@/db/app-role";
import { isLocalDatabase } from "@/db/local";
import { APP_ROLE } from "@/db/settings";

import { fail, runWithDatabase } from "./connect";

const ROTATE_FLAG = "--rotate-password";

/** Set by the CI, whose throwaway database needs a known password. */
function givenPassword(): string | undefined {
  const value = process.env.APP_DATABASE_PASSWORD;
  return value === undefined || value === "" ? undefined : value;
}

/**
 * Creates the site's role (data changes only) and resets its rights, as the
 * owner. Run once per database (and Neon branch), then after each migration
 * that adds a table. A generated password is shown once, in the site's
 * connection string: store it as DATABASE_URL, nowhere else.
 */
async function main(): Promise<void> {
  const unknown = process.argv
    .slice(2)
    .filter((argument) => argument !== ROTATE_FLAG);
  if (unknown.length > 0) {
    fail(
      `db:roles: unknown argument ${unknown.join(" ")} (only ${ROTATE_FLAG}).`,
    );
    return;
  }
  const password = givenPassword();
  if (password !== undefined && !isUsablePassword(password)) {
    fail(
      "db:roles: APP_DATABASE_PASSWORD must be 24 to 128 letters, digits, '-' or '_'.",
    );
    return;
  }
  await runWithDatabase(
    "db:roles",
    async ({ db }, ownerUrl) => {
      // A chosen password guards a throwaway database only: on Neon, whose
      // endpoint is public, the script draws one.
      if (password !== undefined && !isLocalDatabase(ownerUrl)) {
        throw new Error(
          "APP_DATABASE_PASSWORD serves a local database only (the CI): leave it unset, the script generates the password.",
        );
      }
      const outcome = await ensureAppRole(db, {
        password,
        rotate: process.argv.includes(ROTATE_FLAG),
      });
      const done = `role ${APP_ROLE} ${outcome.created ? "created" : "kept"}, its rights reset.`;
      return outcome.generatedPassword === undefined
        ? done
        : `${done}\nThe site's DATABASE_URL, shown once (store it in Vercel, then clear this terminal):\n${appRoleUrl(ownerUrl, outcome.generatedPassword)}`;
    },
    "owner",
  );
}

void main();
