import { describe, expect, it } from "vitest";

import {
  createTotpUri,
  generateHotp,
  generateTotpSecret,
  matchTotp,
  TOTP_PERIOD_SECONDS,
} from "./totp";

// RFC 4226, appendix D, and RFC 6238, appendix B (SHA-1).
const RFC_KEY = new TextEncoder().encode("12345678901234567890");

describe("generateHotp", () => {
  it.each([
    [0, "755224"],
    [1, "287082"],
    [2, "359152"],
    [3, "969429"],
    [4, "338314"],
    [5, "254676"],
    [6, "287922"],
    [7, "162583"],
    [8, "399871"],
    [9, "520489"],
  ])("matches RFC 4226 for counter %i", (counter, code) => {
    expect(generateHotp(RFC_KEY, counter)).toBe(code);
  });

  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ])("matches RFC 6238 at %i s", (seconds, code) => {
    expect(
      generateHotp(RFC_KEY, Math.floor(seconds / TOTP_PERIOD_SECONDS), 8),
    ).toBe(code);
  });
});

describe("matchTotp", () => {
  const at = (seconds: number) => new Date(seconds * 1000);
  const codeAt = (seconds: number) =>
    generateHotp(RFC_KEY, Math.floor(seconds / TOTP_PERIOD_SECONDS));

  it("returns the time step of a current code", () => {
    expect(matchTotp(RFC_KEY, codeAt(1_000_000), at(1_000_000))).toBe(
      Math.floor(1_000_000 / 30),
    );
  });

  it("accepts the previous and the next step, for clock drift", () => {
    expect(matchTotp(RFC_KEY, codeAt(1_000_000 - 30), at(1_000_000))).toBe(
      Math.floor(1_000_000 / 30) - 1,
    );
    expect(matchTotp(RFC_KEY, codeAt(1_000_000 + 30), at(1_000_000))).toBe(
      Math.floor(1_000_000 / 30) + 1,
    );
  });

  it("refuses a code two steps away", () => {
    expect(
      matchTotp(RFC_KEY, codeAt(1_000_000 - 60), at(1_000_000)),
    ).toBeUndefined();
  });

  it.each(["", "12345", "1234567", "12345a", " 123456"])(
    "refuses the malformed code %j",
    (code) => {
      expect(matchTotp(RFC_KEY, code, at(1_000_000))).toBeUndefined();
    },
  );
});

describe("generateTotpSecret", () => {
  it("draws 160 random bits, as RFC 4226 recommends", () => {
    const first = generateTotpSecret();

    expect(first).toHaveLength(20);
    expect(generateTotpSecret()).not.toEqual(first);
  });
});

describe("createTotpUri", () => {
  it("describes the account for authenticator apps", () => {
    const uri = createTotpUri({
      issuer: "Orion · portfolio",
      account: "admin@example.com",
      secret: RFC_KEY,
    });

    // RFC 6238's published test key, in base32: not a secret.
    expect(uri).toBe(
      // nosemgrep: generic.secrets.security.detected-generic-secret.detected-generic-secret
      "otpauth://totp/Orion%20%C2%B7%20portfolio:admin%40example.com?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Orion%20%C2%B7%20portfolio&algorithm=SHA1&digits=6&period=30",
    );
  });
});
