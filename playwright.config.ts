import { defineConfig, devices } from "@playwright/test";

import { E2E_CRON_SECRET } from "./e2e/support/cron";
import { isLocalDatabase } from "./src/db/local";

// Not 3000: the suite must never attach to a running `next dev` instead of the production build.
const PORT = 3100;
const isCI = Boolean(process.env.CI);
const deployedBaseURL = process.env.E2E_BASE_URL;
const baseURL = deployedBaseURL ?? `http://localhost:${PORT}`;

// The server below runs on development secrets, and the tests write to its
// database (contact messages, the admin account): never the real one, which
// `next start` would otherwise read from .env.local.
// The suite's helpers write as the owner (DATABASE_OWNER_URL, else DATABASE_URL).
const ownerUrl = process.env.DATABASE_OWNER_URL ?? "";
if (
  deployedBaseURL === undefined &&
  (!isLocalDatabase(process.env.DATABASE_URL ?? "") ||
    (ownerUrl !== "" && !isLocalDatabase(ownerUrl)))
) {
  throw new Error(
    "pnpm e2e needs DATABASE_URL (and DATABASE_OWNER_URL, if set) on a local database, migrated and seeded (see README).",
  );
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    // The site is French-first: browsers default to a French Accept-Language unless a test opts out.
    locale: "fr-FR",
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Against a deployed preview (E2E_BASE_URL) nothing is started; otherwise the production build is tested.
  webServer: deployedBaseURL
    ? undefined
    : {
        // Loopback only: the E2E account's password and TOTP secret are public.
        command: `pnpm build && pnpm start --hostname localhost --port ${PORT}`,
        // A production build on development secrets (test keys, public salt and
        // sealing key: e2e/support/admin.ts seals with it), and no notification
        // email, whatever .env.local holds. Empty reads as unset.
        env: {
          ALLOW_DEVELOPMENT_SECRETS: "true",
          TOTP_ENCRYPTION_KEY: "",
          IP_HASH_SALT: "",
          RESEND_API_KEY: "",
          // The site connects as its own role (DATABASE_URL), never as the owner.
          DATABASE_OWNER_URL: "",
          // The daily cron's bearer token, whatever .env.local holds (e2e/cron.spec.ts).
          CRON_SECRET: E2E_CRON_SECRET,
        },
        url: baseURL,
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
