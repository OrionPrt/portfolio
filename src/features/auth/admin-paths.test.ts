import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  isAdminPath,
  KNOWN_ADMIN_PATHS,
  PUBLIC_ADMIN_PATHS,
} from "./admin-paths";

const APP = path.join(process.cwd(), "src/app");

/** Every page under src/app/admin, as its URL path. */
function adminPages(directory = path.join(APP, "admin")): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return adminPages(full);
    }
    return entry.name === "page.tsx"
      ? [`/${path.relative(APP, directory)}`]
      : [];
  });
}

describe("admin paths", () => {
  it("list exactly the admin pages, so none is answered 404", () => {
    expect([...KNOWN_ADMIN_PATHS].sort()).toEqual(adminPages().sort());
  });

  it("only leave the login and its steps public", () => {
    expect(
      [...PUBLIC_ADMIN_PATHS].every((page) => page.startsWith("/admin/login")),
    ).toBe(true);
  });

  it.each([
    ["/admin", true],
    ["/admin/security", true],
    ["/administration", false],
    ["/fr/admin", false],
  ])("knows whether %s is an admin path (%s)", (pathname, expected) => {
    expect(isAdminPath(pathname)).toBe(expected);
  });
});
