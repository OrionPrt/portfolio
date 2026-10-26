import { ok, type Result } from "@/lib/result";

import type { AuthDependencies } from "./auth-dependencies";
import { startSession, type StartedSession } from "./session-service";
import { throttleKeyOf } from "./throttle-policy";
import {
  attemptKeysOf,
  isLocked,
  reserveAttempt,
  settleSignIn,
  type AttemptKeys,
  type AttemptReservation,
} from "./throttle-service";
import type { AdminUserRecord } from "./users-repository";

/** Who is attempting: in memory only, except the network's keyed hash. */
export interface AttemptContext {
  readonly network: string;
  readonly networkHash: string;
  readonly userAgent: string | null;
}

/** Every refusal reads the same, whatever failed: no hint for an attacker. */
export type Refusal = "refused" | "locked";

export type SignedInOutcome =
  | { readonly status: Refusal }
  | { readonly status: "signed_in"; readonly session: StartedSession };

/** Lockout alerts go out at most once an hour, however many networks lock. */
const ALERT_INTERVAL_MS = 60 * 60_000;

export function auditContext(context: AttemptContext) {
  return { ipHash: context.networkHash, userAgent: context.userAgent };
}

export type AttemptStart =
  | { readonly status: "locked" }
  | {
      readonly status: "allowed";
      readonly keys: AttemptKeys;
      readonly reservation: AttemptReservation;
    };

/**
 * Before a password or code is checked: refused while a lock runs, then
 * counted. A burst of parallel attempts gets no more checks than the policy
 * allows, since each one is counted first (throttle-repository `reserve`).
 */
export async function beginAttempt(
  deps: AuthDependencies,
  context: AttemptContext,
  { email, isTotp }: { readonly email: string; readonly isTotp: boolean },
): Promise<Result<AttemptStart>> {
  const keys = attemptKeysOf(
    { network: context.network, email, isTotp },
    deps.salt,
  );
  const now = deps.now();
  const locked = await isLocked(deps.throttles, keys, now);
  if (!locked.ok || locked.data) {
    return locked.ok ? ok({ status: "locked" }) : locked;
  }
  const reservation = await reserveAttempt(deps.throttles, keys, now);
  if (!reservation.ok) {
    return reservation;
  }
  return reservation.data.allowed
    ? ok({ status: "allowed", keys, reservation: reservation.data })
    : ok({ status: "locked" });
}

interface FailedAttempt {
  readonly reservation: AttemptReservation;
  /** The account, when the email matched one: only then is it audited. */
  readonly user: AdminUserRecord | undefined;
  readonly step: "password" | "totp" | "recovery_code";
}

/**
 * A wrong password or code, already counted. Audits and the alert run after
 * the response: an unknown email takes the same time as a real one. The
 * owner is emailed when a lock starts, at most once an hour.
 */
export function failAttempt(
  deps: AuthDependencies,
  context: AttemptContext,
  { reservation, user, step }: FailedAttempt,
): Refusal {
  if (user !== undefined) {
    const now = deps.now();
    const actor = { actorId: user.id, ...auditContext(context) };
    deps.defer(async () => {
      await deps.audit.record({
        ...actor,
        action: "auth.login_failed",
        diff: { step },
      });
      if (!reservation.startsLock) {
        return;
      }
      const recent = await deps.audit.countSince(
        "auth.account_locked",
        new Date(now.getTime() - ALERT_INTERVAL_MS),
      );
      await deps.audit.record({ ...actor, action: "auth.account_locked" });
      if (
        recent.ok &&
        recent.data === 0 &&
        reservation.lockedUntil !== undefined
      ) {
        deps.alertLockout({ at: now, until: reservation.lockedUntil });
      }
    });
  }
  return reservation.lockedUntil === undefined ? "refused" : "locked";
}

interface CompletedAttempt {
  readonly user: AdminUserRecord;
  readonly reservation: AttemptReservation;
  /** The partial session the second factor completes: used up here, once. */
  readonly partialSessionId: string;
  readonly method: "totp" | "recovery_code";
}

/**
 * A full sign-in. The partial session is consumed at its stage in one
 * statement (a race with the same session completes once); a new token is
 * issued; the account's counts start over; the success is audited.
 */
export async function completeSignIn(
  deps: AuthDependencies,
  context: AttemptContext,
  { user, reservation, partialSessionId, method }: CompletedAttempt,
): Promise<Result<SignedInOutcome>> {
  const now = deps.now();
  const consumed = await deps.sessions.consumeAtStage(
    partialSessionId,
    user.id,
    "totp_challenge",
    now,
  );
  if (!consumed.ok || !consumed.data) {
    return consumed.ok ? ok({ status: "refused" }) : consumed;
  }
  const session = await startSession(deps.sessions, {
    userId: user.id,
    stage: "signed_in",
    now,
    ipHash: context.networkHash,
    userAgent: context.userAgent,
  });
  if (!session.ok) {
    return session;
  }
  await settleSignIn(
    deps.throttles,
    reservation,
    secondFactorKeyOf(user, deps),
  );
  await deps.audit.record({
    actorId: user.id,
    action: "auth.login_succeeded",
    diff: { method },
    ...auditContext(context),
  });
  return ok({ status: "signed_in", session: session.data });
}

/** The account's TOTP counter, cleared by any proof of the second factor. */
export function secondFactorKeyOf(
  user: AdminUserRecord,
  deps: Pick<AuthDependencies, "salt">,
): string {
  return throttleKeyOf({
    scope: "second_factor",
    email: user.email,
    salt: deps.salt,
  });
}
