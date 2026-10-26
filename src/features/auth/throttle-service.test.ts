import { describe, expect, it, vi } from "vitest";

import { ok } from "@/lib/result";

import { THROTTLE_POLICY } from "./throttle-policy";
import type { Reservation } from "./throttle-repository";
import {
  attemptKeysOf,
  isLocked,
  refundAttempt,
  reserveAttempt,
  settleSignIn,
  type ThrottleStore,
} from "./throttle-service";
import type { ThrottleScope } from "./vocabulary";

const SALT = "s".repeat(32);
const NOW = new Date("2026-10-25T12:00:00Z");
const LATER = new Date(NOW.getTime() + 60_000);

function store(
  reservations: Partial<Record<ThrottleScope, Reservation>> = {},
): ThrottleStore {
  return {
    lockedUntil: vi.fn(() => Promise.resolve(ok(undefined))),
    reserve: vi.fn(({ scope }: { scope: ThrottleScope }) =>
      Promise.resolve(
        ok(
          reservations[scope] ?? {
            failures: 1,
            allowed: true,
            lockedUntil: undefined,
          },
        ),
      ),
    ),
    refund: vi.fn(() => Promise.resolve(ok(undefined))),
    clear: vi.fn(() => Promise.resolve(ok(undefined))),
  };
}

describe("attemptKeysOf", () => {
  it("adds the account's TOTP key for a TOTP code only", () => {
    const subject = { network: "203.0.113.7", email: "admin@example.com" };

    expect(
      attemptKeysOf({ ...subject, isTotp: true }, SALT).secondFactor,
    ).toMatch(/^[0-9a-f]{64}$/);
    expect(
      attemptKeysOf({ ...subject, isTotp: false }, SALT).secondFactor,
    ).toBeUndefined();
  });
});

describe("reserveAttempt", () => {
  const keys = attemptKeysOf(
    { network: "203.0.113.7", email: "admin@example.com", isTotp: true },
    SALT,
  );

  it("counts the attempt against every key, each with its policy", async () => {
    const throttles = store();

    expect(await reserveAttempt(throttles, keys, NOW)).toEqual(
      ok({
        allowed: true,
        lockedUntil: undefined,
        startsLock: false,
        counted: [
          { scope: "network", key: keys.network, lockedUntil: undefined },
          { scope: "account", key: keys.account, lockedUntil: undefined },
          {
            scope: "second_factor",
            key: keys.secondFactor,
            lockedUntil: undefined,
          },
        ],
      }),
    );
    expect(
      vi.mocked(throttles.reserve).mock.calls.map(([input]) => input),
    ).toEqual([
      {
        key: keys.network,
        scope: "network",
        policy: THROTTLE_POLICY.network,
        now: NOW,
      },
      {
        key: keys.account,
        scope: "account",
        policy: THROTTLE_POLICY.account,
        now: NOW,
      },
      {
        key: keys.secondFactor,
        scope: "second_factor",
        policy: THROTTLE_POLICY.second_factor,
        now: NOW,
      },
    ]);
  });

  it("refuses the check when any key was locked as the attempt arrived", async () => {
    const throttles = store({
      second_factor: { failures: 12, allowed: false, lockedUntil: LATER },
    });

    expect(await reserveAttempt(throttles, keys, NOW)).toMatchObject(
      ok({ allowed: false, lockedUntil: LATER, startsLock: false }),
    );
  });

  it("says when this attempt starts the account's lock: the one to alert on", async () => {
    const throttles = store({
      account: { failures: 5, allowed: true, lockedUntil: LATER },
    });

    expect(await reserveAttempt(throttles, keys, NOW)).toMatchObject(
      ok({ allowed: true, lockedUntil: LATER, startsLock: true }),
    );
  });
});

describe("isLocked", () => {
  it("checks every key of the attempt", async () => {
    const throttles = store();
    const keys = attemptKeysOf(
      { network: "203.0.113.7", email: "admin@example.com", isTotp: false },
      SALT,
    );

    expect(await isLocked(throttles, keys, NOW)).toEqual(ok(false));
    expect(throttles.lockedUntil).toHaveBeenCalledWith(
      [keys.network, keys.account],
      NOW,
    );
  });
});

describe("after a success", () => {
  const keys = attemptKeysOf(
    { network: "203.0.113.7", email: "admin@example.com", isTotp: false },
    SALT,
  );

  async function reserved(throttles: ThrottleStore) {
    const reservation = await reserveAttempt(throttles, keys, NOW);
    if (!reservation.ok) {
      throw new Error("No reservation");
    }
    return reservation.data;
  }

  it("gives back a password step's reservations with the locks they set, keeping earlier failures", async () => {
    const throttles = store({
      account: { failures: 6, allowed: true, lockedUntil: LATER },
    });

    await refundAttempt(throttles, await reserved(throttles));

    expect(vi.mocked(throttles.refund).mock.calls).toEqual([
      [keys.network, THROTTLE_POLICY.network, undefined],
      [keys.account, THROTTLE_POLICY.account, LATER],
    ]);
    expect(throttles.clear).not.toHaveBeenCalled();
  });

  it("starts the account's counts over after a full sign-in", async () => {
    const throttles = store({
      network: { failures: 30, allowed: true, lockedUntil: LATER },
    });

    await settleSignIn(throttles, await reserved(throttles), "f".repeat(64));

    expect(throttles.clear).toHaveBeenCalledWith([
      keys.account,
      "f".repeat(64),
    ]);
    expect(throttles.refund).toHaveBeenCalledWith(
      keys.network,
      THROTTLE_POLICY.network,
      LATER,
    );
  });
});
