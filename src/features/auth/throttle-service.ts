import { ok, type Result } from "@/lib/result";

import { isLockStart, THROTTLE_POLICY, throttleKeyOf } from "./throttle-policy";
import type { ThrottleRepository } from "./throttle-repository";
import type { ThrottleScope } from "./vocabulary";

export type ThrottleStore = Pick<
  ThrottleRepository,
  "lockedUntil" | "reserve" | "refund" | "clear"
>;

/** The keys an attempt counts against; the email typed is never stored. */
export interface AttemptKeys {
  readonly network: string;
  readonly account: string;
  /** Only for a TOTP code: every network's codes for this account. */
  readonly secondFactor: string | undefined;
}

interface AttemptSubject {
  readonly network: string;
  readonly email: string;
  readonly isTotp: boolean;
}

export function attemptKeysOf(
  { network, email, isTotp }: AttemptSubject,
  salt: string,
): AttemptKeys {
  return {
    network: throttleKeyOf({ scope: "network", network, salt }),
    account: throttleKeyOf({ scope: "account", network, email, salt }),
    secondFactor: isTotp
      ? throttleKeyOf({ scope: "second_factor", email, salt })
      : undefined,
  };
}

function scopedKeys(
  keys: AttemptKeys,
): readonly (readonly [ThrottleScope, string])[] {
  return [
    ["network", keys.network],
    ["account", keys.account],
    ...(keys.secondFactor === undefined
      ? []
      : [["second_factor", keys.secondFactor] as const]),
  ];
}

/** Whether a lock already runs: such an attempt is refused without being counted. */
export async function isLocked(
  store: ThrottleStore,
  keys: AttemptKeys,
  now: Date,
): Promise<Result<boolean>> {
  const until = await store.lockedUntil(
    scopedKeys(keys).map(([, key]) => key),
    now,
  );
  return until.ok ? ok(until.data !== undefined) : until;
}

/** One key the attempt was counted against, and the lock its count left there. */
interface CountedKey {
  readonly scope: ThrottleScope;
  readonly key: string;
  readonly lockedUntil: Date | undefined;
}

export interface AttemptReservation {
  /** False: a lock ran as the attempt arrived; its password or code is not checked. */
  readonly allowed: boolean;
  /** The end of the lock running now, possibly started by this attempt. */
  readonly lockedUntil: Date | undefined;
  /** This attempt started the account's lock, or the second factor's: alert if it fails. */
  readonly startsLock: boolean;
  /** What a refund gives back, key by key. */
  readonly counted: readonly CountedKey[];
}

/** Counts the attempt against each of its keys before anything is checked. */
export async function reserveAttempt(
  store: ThrottleStore,
  keys: AttemptKeys,
  now: Date,
): Promise<Result<AttemptReservation>> {
  let allowed = true;
  let until: Date | undefined;
  let startsLock = false;
  const counted: CountedKey[] = [];
  for (const [scope, key] of scopedKeys(keys)) {
    const reserved = await store.reserve({
      key,
      scope,
      policy: THROTTLE_POLICY[scope],
      now,
    });
    if (!reserved.ok) {
      return reserved;
    }
    const { failures, lockedUntil } = reserved.data;
    counted.push({ scope, key, lockedUntil });
    allowed &&= reserved.data.allowed;
    if (
      lockedUntil !== undefined &&
      lockedUntil > now &&
      (until === undefined || lockedUntil > until)
    ) {
      until = lockedUntil;
    }
    startsLock ||= scope !== "network" && isLockStart(scope, failures);
  }
  return ok({ allowed, lockedUntil: until, startsLock, counted });
}

function refundKey(
  store: ThrottleStore,
  { scope, key, lockedUntil }: CountedKey,
): Promise<Result<void>> {
  return store.refund(key, THROTTLE_POLICY[scope], lockedUntil);
}

/**
 * A password step that succeeded: its reservations are given back. The
 * account's count is kept until the second factor too succeeds, so a
 * password holder cannot reset it by signing in again.
 */
export async function refundAttempt(
  store: ThrottleStore,
  reservation: AttemptReservation,
): Promise<Result<void>> {
  for (const counted of reservation.counted) {
    const refunded = await refundKey(store, counted);
    if (!refunded.ok) {
      return refunded;
    }
  }
  return ok(undefined);
}

/**
 * A full sign-in (or re-authentication): the account's counts start over,
 * from this network and for its TOTP codes; the network gets its attempt back.
 */
export async function settleSignIn(
  store: ThrottleStore,
  reservation: AttemptReservation,
  secondFactorKey: string,
): Promise<Result<void>> {
  const account = reservation.counted.filter(
    ({ scope }) => scope === "account",
  );
  const cleared = await store.clear([
    ...account.map(({ key }) => key),
    secondFactorKey,
  ]);
  if (!cleared.ok) {
    return cleared;
  }
  const network = reservation.counted.find(({ scope }) => scope === "network");
  return network === undefined ? ok(undefined) : refundKey(store, network);
}
