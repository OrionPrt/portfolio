import { describe, expect, it } from "vitest";

import { hashIp } from "./ip-hash";

describe("hashIp", () => {
  it("gives the same 64-hex-digit hash for the same address and salt", () => {
    const hash = hashIp("203.0.113.7", "s".repeat(32));

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("203.0.113.7", "s".repeat(32))).toBe(hash);
  });

  it("changes with the salt, so a leaked hash cannot be looked up without it", () => {
    expect(hashIp("203.0.113.7", "a".repeat(32))).not.toBe(
      hashIp("203.0.113.7", "b".repeat(32)),
    );
  });
});
