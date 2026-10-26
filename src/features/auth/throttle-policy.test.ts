import { describe, expect, it } from "vitest";

import {
  isLockStart,
  lockDurationMs,
  THROTTLE_POLICY,
  throttleKeyOf,
} from "./throttle-policy";

const SALT = "s".repeat(32);
const minutes = (count: number) => count * 60_000;

describe("lockDurationMs", () => {
  it.each([
    [4, undefined],
    [5, minutes(1)],
    [6, minutes(2)],
    [7, minutes(4)],
    [10, minutes(32)],
    [11, minutes(60)],
    [40, minutes(60)],
  ])(
    "locks an account from one network after %i failures for %s ms",
    (failures, duration) => {
      expect(lockDurationMs("account", failures)).toBe(duration);
    },
  );

  it("locks a whole network for an hour after many failures", () => {
    const { lockAfter } = THROTTLE_POLICY.network;

    expect(lockDurationMs("network", lockAfter - 1)).toBeUndefined();
    expect(lockDurationMs("network", lockAfter)).toBe(minutes(60));
  });
});

describe("isLockStart", () => {
  it("is the failure that first locks, the moment to alert the owner", () => {
    expect(isLockStart("account", 4)).toBe(false);
    expect(isLockStart("account", 5)).toBe(true);
    expect(isLockStart("account", 6)).toBe(false);
  });
});

describe("throttleKeyOf", () => {
  it("keys a network, and an account from that network, apart", () => {
    const network = throttleKeyOf({
      scope: "network",
      network: "203.0.113.7",
      salt: SALT,
    });
    const account = throttleKeyOf({
      scope: "account",
      network: "203.0.113.7",
      email: "admin@example.com",
      salt: SALT,
    });

    expect(network).toMatch(/^[0-9a-f]{64}$/);
    expect(account).toMatch(/^[0-9a-f]{64}$/);
    expect(account).not.toBe(network);
  });

  it("treats the typed email case-insensitively, and never stores it", () => {
    const lower = throttleKeyOf({
      scope: "account",
      network: "203.0.113.7",
      email: "admin@example.com",
      salt: SALT,
    });

    expect(
      throttleKeyOf({
        scope: "account",
        network: "203.0.113.7",
        email: " Admin@Example.com ",
        salt: SALT,
      }),
    ).toBe(lower);
    expect(lower).not.toContain("admin");
  });

  it("locks an account from one network only: another network is unaffected", () => {
    const from = (network: string) =>
      throttleKeyOf({
        scope: "account",
        network,
        email: "admin@example.com",
        salt: SALT,
      });

    expect(from("203.0.113.7")).not.toBe(from("198.51.100.2"));
  });
});

describe("second-factor key", () => {
  it("is the same from every network, apart from the account's network key", () => {
    const secondFactor = throttleKeyOf({
      scope: "second_factor",
      email: "Admin@Example.com",
      salt: SALT,
    });

    expect(secondFactor).toBe(
      throttleKeyOf({
        scope: "second_factor",
        email: "admin@example.com",
        salt: SALT,
      }),
    );
    expect(secondFactor).not.toBe(
      throttleKeyOf({
        scope: "account",
        network: "203.0.113.7",
        email: "admin@example.com",
        salt: SALT,
      }),
    );
  });

  it("locks the TOTP step for an hour after 10 codes, doubling up to a day", () => {
    expect(lockDurationMs("second_factor", 9)).toBeUndefined();
    expect(lockDurationMs("second_factor", 10)).toBe(minutes(60));
    expect(lockDurationMs("second_factor", 11)).toBe(minutes(120));
    expect(lockDurationMs("second_factor", 20)).toBe(minutes(24 * 60));
  });
});
