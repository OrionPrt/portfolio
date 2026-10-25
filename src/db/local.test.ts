import { describe, expect, it } from "vitest";

import { isLocalDatabase } from "./local";

describe("isLocalDatabase", () => {
  it.each([
    "postgresql://postgres@localhost:5432/portfolio",
    "postgres://app:pw@127.0.0.1/portfolio",
    "postgresql://app@[::1]:5432/portfolio",
  ])("speaks plain Postgres to %s", (url) => {
    expect(isLocalDatabase(url)).toBe(true);
  });

  it.each([
    "postgresql://app:pw@ep-cool.eu-central-1.aws.neon.tech/neondb",
    // A Neon host that merely starts with "localhost" stays remote.
    "postgresql://app:pw@localhost.example.com/db",
    "not a url",
  ])("reaches %s through Neon", (url) => {
    expect(isLocalDatabase(url)).toBe(false);
  });
});
