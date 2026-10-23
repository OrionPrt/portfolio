import { defineConfig, devices } from "@playwright/test";

// Not 3000: the suite must never attach to a running `next dev` instead of the production build.
const PORT = 3100;
const isCI = Boolean(process.env.CI);
const deployedBaseURL = process.env.E2E_BASE_URL;
const baseURL = deployedBaseURL ?? `http://localhost:${PORT}`;

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
        command: `pnpm build && pnpm start --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
