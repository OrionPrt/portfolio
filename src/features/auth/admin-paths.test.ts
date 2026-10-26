import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ADMIN_PATTERNS,
  isAdminPath,
  isKnownAdminPath,
  KNOWN_ADMIN_PATHS,
  messagePath,
  PUBLIC_ADMIN_PATHS,
} from "./admin-paths";

const APP = path.join(process.cwd(), "src/app");

/** Every page under src/app/admin, as its URL path: route groups add no segment. */
function adminPages(directory = path.join(APP, "admin")): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return adminPages(full);
    }
    if (entry.name !== "page.tsx") {
      return [];
    }
    const segments = path
      .relative(APP, directory)
      .split(path.sep)
      .filter((segment) => !/^\(.+\)$/.test(segment));
    return [`/${segments.join("/")}`];
  });
}

describe("admin paths", () => {
  it("list exactly the admin pages, so none is answered 404", () => {
    expect([...KNOWN_ADMIN_PATHS, ...ADMIN_PATTERNS].sort()).toEqual(
      adminPages().sort(),
    );
  });

  const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

  it.each([
    ["/admin/messages", true],
    [messagePath(ID), true],
    [`/admin/messages/${ID.toUpperCase()}`, false],
    ["/admin/messages/42", false],
    [`/admin/messages/${ID}/x`, false],
    ["/admin/messages/[id]", false],
  ])("routes %s (%s)", (pathname, expected) => {
    expect(isKnownAdminPath(pathname)).toBe(expected);
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
