import { createHmac } from "node:crypto";

import type { ThrottleScope } from "./vocabulary";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export interface ThrottlePolicy {
  /** Counts start again after this long. */
  readonly windowMs: number;
  /** The count that starts a lock. */
  readonly lockAfter: number;
  /** The first lock; each later count doubles it, up to maxLockMs. */
  readonly firstLockMs: number;
  readonly maxLockMs: number;
}

/**
 * Failed sign-ins, counted before each password or code is checked:
 * - account from a network: 5 within a day lock that pair for 1 minute,
 *   doubling up to an hour. Someone elsewhere cannot lock the owner out;
 * - network: 30 within an hour lock it for an hour, whatever the accounts;
 * - second factor: 10 wrong TOTP codes within a day, from any network, lock
 *   the account's TOTP step for an hour, doubling up to a day. Only a password
 *   holder gets there, so no anonymous attacker can trigger it; recovery
 *   codes (120 bits) still work meanwhile.
 */
export const THROTTLE_POLICY: Readonly<Record<ThrottleScope, ThrottlePolicy>> =
  {
    account: {
      windowMs: 24 * HOUR_MS,
      lockAfter: 5,
      firstLockMs: MINUTE_MS,
      maxLockMs: HOUR_MS,
    },
    network: {
      windowMs: HOUR_MS,
      lockAfter: 30,
      firstLockMs: HOUR_MS,
      maxLockMs: HOUR_MS,
    },
    second_factor: {
      windowMs: 24 * HOUR_MS,
      lockAfter: 10,
      firstLockMs: HOUR_MS,
      maxLockMs: 24 * HOUR_MS,
    },
  };

/** How long `failures` failures lock a key, or undefined below the threshold. */
export function lockDurationMs(
  scope: ThrottleScope,
  failures: number,
): number | undefined {
  const { lockAfter, firstLockMs, maxLockMs } = THROTTLE_POLICY[scope];
  if (failures < lockAfter) {
    return undefined;
  }
  return Math.min(firstLockMs * 2 ** (failures - lockAfter), maxLockMs);
}

/** The count that first locks a key in its window: the one to alert on. */
export function isLockStart(scope: ThrottleScope, failures: number): boolean {
  return failures === THROTTLE_POLICY[scope].lockAfter;
}

function keyedHash(value: string, salt: string): string {
  return createHmac("sha256", salt).update(value).digest("hex");
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

type ThrottleKeyInput =
  | {
      readonly scope: "network";
      readonly network: string;
      readonly salt: string;
    }
  | {
      readonly scope: "account";
      readonly network: string;
      readonly email: string;
      readonly salt: string;
    }
  | {
      readonly scope: "second_factor";
      readonly email: string;
      readonly salt: string;
    };

/** The row an attempt counts against: a keyed hash, so no address or email is stored. */
export function throttleKeyOf(input: ThrottleKeyInput): string {
  switch (input.scope) {
    case "network":
      return keyedHash(`network|${input.network}`, input.salt);
    case "account":
      return keyedHash(
        `account|${input.network}|${normalizedEmail(input.email)}`,
        input.salt,
      );
    case "second_factor":
      return keyedHash(
        `second_factor|${normalizedEmail(input.email)}`,
        input.salt,
      );
  }
}
