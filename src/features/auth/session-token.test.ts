import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  generateSessionToken,
  isWellFormedSessionToken,
  sessionIdOf,
} from "./session-token";

describe("generateSessionToken", () => {
  it("draws 256 random bits, written in base32", () => {
    const token = generateSessionToken();

    expect(token).toMatch(/^[a-z2-7]{52}$/);
    expect(generateSessionToken()).not.toBe(token);
  });
});

describe("sessionIdOf", () => {
  it("is the token's SHA-256: the database never holds the token", () => {
    const token = generateSessionToken();

    expect(sessionIdOf(token)).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
  });
});

describe("isWellFormedSessionToken", () => {
  it.each([
    ["", false],
    ["a".repeat(51), false],
    ["A".repeat(52), false],
    ["a".repeat(52), true],
  ])("reads %j as %s", (token, expected) => {
    expect(isWellFormedSessionToken(token)).toBe(expected);
  });
});
