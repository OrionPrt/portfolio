import { describe, expect, it } from "vitest";

import {
  checkPasswordPolicy,
  hashPassword,
  PASSWORD_LIMITS,
  verifyDummyPassword,
  verifyPassword,
} from "./password";

const PASSWORD = "correct horse battery staple";

describe("hashPassword / verifyPassword", () => {
  it("hashes with argon2id at OWASP's parameters, and verifies", async () => {
    const hash = await hashPassword(PASSWORD);

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword(hash, PASSWORD)).toBe(true);
    expect(await verifyPassword(hash, `${PASSWORD}!`)).toBe(false);
  });

  it("never hashes a password the same way twice", async () => {
    expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD));
  });

  it("accepts a password typed with composed or decomposed accents alike", async () => {
    const hash = await hashPassword("mot de passe très long, é");

    expect(await verifyPassword(hash, "mot de passe très long, é")).toBe(true);
  });

  it("refuses rather than throws on a malformed hash", async () => {
    expect(await verifyPassword("$argon2id$broken", PASSWORD)).toBe(false);
  });

  it("verifies against a dummy hash, which never matches", async () => {
    expect(await verifyDummyPassword(PASSWORD)).toBe(false);
  });
});

describe("checkPasswordPolicy", () => {
  const email = "admin@example.com";

  it.each([
    ["a".repeat(PASSWORD_LIMITS.min - 1), "too_short"],
    ["a".repeat(PASSWORD_LIMITS.max + 1), "too_long"],
    // Characters, not bytes or UTF-16 units: 14 emoji are still too short.
    ["🔐".repeat(PASSWORD_LIMITS.min - 1), "too_short"],
    ["Admin@Example.com is my password", "contains_context_word"],
    ["my ADMIN account's long password", "contains_context_word"],
    // The documented context words (ASVS 6.1.2).
    ["Orion is my favourite constellation", "contains_context_word"],
    ["une phrase de passe pour le PORTFOLIO", "contains_context_word"],
  ])("refuses %j as %s", (password, problem) => {
    expect(checkPasswordPolicy(password, email)).toEqual({
      ok: false,
      error: problem,
    });
  });

  it.each([
    "a".repeat(PASSWORD_LIMITS.min),
    "🔐".repeat(PASSWORD_LIMITS.min),
    // No composition rules (ASVS): length is what matters.
    "un mot de passe tout en minuscules",
  ])("accepts %j", (password) => {
    expect(checkPasswordPolicy(password, email)).toEqual({
      ok: true,
      data: undefined,
    });
  });
});
