import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const COVERAGE_THRESHOLD = 80;

// Server modules import "server-only", which throws outside React Server Components;
// Node tests stand in for the server, so they get the package's no-op build.
const serverOnlyStub = {
  "server-only": fileURLToPath(
    new URL("./node_modules/server-only/empty.js", import.meta.url),
  ),
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // next-intl's ESM build imports "next/server" without an extension, which Node's own
    // resolver rejects; letting Vite transform it resolves the import like Next.js does.
    server: { deps: { inline: ["next-intl"] } },
    // Server and utility code runs in Node; React components run in jsdom.
    projects: [
      {
        extends: true,
        resolve: { alias: serverOnlyStub },
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.db.test.ts"],
        },
      },
      {
        extends: true,
        resolve: { alias: serverOnlyStub },
        test: {
          // Each file boots its own PGlite database (WebAssembly) and migrates it.
          // Booting several at once starved the CPU past the hook timeout,
          // so these files run one at a time, alongside the other projects.
          name: "db",
          environment: "node",
          include: ["src/**/*.db.test.ts"],
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./test/setup-dom.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      // No HTML report: its bundled JS would be picked up by ESLint. lcov.info feeds CI badges.
      reporter: ["text", "json-summary", "lcovonly"],
      include: ["src/**/*.{ts,tsx}"],
      // Route files (pages, layouts) are exercised by Playwright, not by unit tests.
      exclude: ["src/app/**", "src/**/*.test.{ts,tsx}", "src/**/*.d.ts"],
      thresholds: {
        lines: COVERAGE_THRESHOLD,
        functions: COVERAGE_THRESHOLD,
        branches: COVERAGE_THRESHOLD,
        statements: COVERAGE_THRESHOLD,
      },
    },
  },
});
