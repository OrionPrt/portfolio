import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_COUNT,
} from "./recovery-codes";

describe("generateRecoveryCodes", () => {
  it("makes ten distinct codes of 120 random bits, in groups of four", () => {
    const codes = generateRecoveryCodes();

    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) {
      // 24 base32 characters: 24 × 5 = 120 bits, over ASVS's 112 for a plain hash.
      expect(code).toMatch(/^[a-z2-7]{4}(-[a-z2-7]{4}){5}$/);
    }
  });
});

describe("normalizeRecoveryCode", () => {
  const CODE = "abcd-efgh-ijkl-mnop-qrst-uvwx";

  it.each([
    [CODE, "abcdefghijklmnopqrstuvwx"],
    [
      ` ${CODE.toUpperCase().replaceAll("-", " ")} `,
      "abcdefghijklmnopqrstuvwx",
    ],
    ["abcdefghijklmnopqrstuvwx", "abcdefghijklmnopqrstuvwx"],
  ])("reads %j as %j", (input, normalized) => {
    expect(normalizeRecoveryCode(input)).toBe(normalized);
  });

  it.each([
    "",
    "abcde-fghij",
    `${CODE}-a`,
    CODE.replace("x", "1"),
    CODE.replaceAll("-", "_"),
  ])("refuses %j", (input) => {
    expect(normalizeRecoveryCode(input)).toBeUndefined();
  });
});

describe("hashRecoveryCode", () => {
  it("is the SHA-256 of the normalized code", () => {
    expect(hashRecoveryCode("abcdefghijklmnopqrstuvwx")).toBe(
      createHash("sha256").update("abcdefghijklmnopqrstuvwx").digest("hex"),
    );
  });
});
