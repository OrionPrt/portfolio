import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isUnroutedPath, ROUTED_PATHS } from "./non-localized-routes";

/** Every route handler under src/app/api, as its URL path. */
function apiRoutes(
  directory = path.join(process.cwd(), "src/app/api"),
): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return apiRoutes(full);
    }
    return entry.name === "route.ts"
      ? [`/${path.relative(path.join(process.cwd(), "src/app"), directory)}`]
      : [];
  });
}

describe("non-localized routes", () => {
  it("lists exactly the route handlers that exist, so none is answered 404", () => {
    expect([...ROUTED_PATHS].sort()).toEqual(apiRoutes().sort());
  });

  it.each([
    ["/api/nothing", true],
    ["/.well-known/security.txt", true],
    ["/api/csp-report", false],
    ["/assets/hero.webp", false],
    ["/_vercel/insights/script.js", false],
    ["/fr/projets", false],
  ])("knows whether %s is unrouted (%s)", (pathname, unrouted) => {
    expect(isUnroutedPath(pathname)).toBe(unrouted);
  });
});
