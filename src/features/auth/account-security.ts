import { logger } from "@/lib/logger";
import { ok, type Result } from "@/lib/result";

import {
  auditContext,
  beginAttempt,
  failAttempt,
  secondFactorKeyOf,
  type AttemptContext,
  type Refusal,
} from "./attempts";
import type { AuthDependencies } from "./auth-dependencies";
import { issueRecoveryCodes } from "./enrollment";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "./password";
import { refundAttempt, settleSignIn } from "./throttle-service";
import { acceptTotpCode } from "./totp-code";
import type { AdminUserRecord } from "./users-repository";
import type { PasswordProblem } from "./vocabulary";

/** The signed-in session acting, as the DAL reported it. */
export interface CurrentSession {
  readonly sessionId: string;
  readonly userId: string;
  readonly email: string;
}

type Verified =
  | { readonly status: Refusal }
  | { readonly status: "verified"; readonly user: AdminUserRecord };

type StepOutcome = Refusal | "verified";

/**
 * The current password, counted like a sign-in's password step: given back
 * when right. A wrong one never reaches the second factor's counter.
 */
async function checkPasswordStep(
  user: AdminUserRecord,
  password: string,
  context: AttemptContext,
  deps: AuthDependencies,
): Promise<Result<StepOutcome>> {
  const attempt = await beginAttempt(deps, context, {
    email: user.email,
    isTotp: false,
  });
  if (!attempt.ok || attempt.data.status === "locked") {
    return attempt.ok ? ok("locked") : attempt;
  }
  const { reservation } = attempt.data;
  if (!(await verifyPassword(user.passwordHash, password))) {
    return ok(
      failAttempt(deps, context, { reservation, user, step: "password" }),
    );
  }
  const refunded = await refundAttempt(deps.throttles, reservation);
  return refunded.ok ? ok("verified") : refunded;
}

/** A TOTP code, counted against the account from every network too. */
async function checkCodeStep(
  user: AdminUserRecord,
  code: string,
  context: AttemptContext,
  deps: AuthDependencies,
): Promise<Result<StepOutcome>> {
  const attempt = await beginAttempt(deps, context, {
    email: user.email,
    isTotp: true,
  });
  if (!attempt.ok || attempt.data.status === "locked") {
    return attempt.ok ? ok("locked") : attempt;
  }
  const { reservation } = attempt.data;
  const accepted = await acceptTotpCode(user, code, deps);
  if (!accepted.ok || !accepted.data) {
    return accepted.ok
      ? ok(failAttempt(deps, context, { reservation, user, step: "totp" }))
      : accepted;
  }
  await settleSignIn(
    deps.throttles,
    reservation,
    secondFactorKeyOf(user, deps),
  );
  return ok("verified");
}

/**
 * Re-checks the owner before a sensitive change: the password when asked,
 * then a TOTP code. A stolen session alone cannot change them. Attempts
 * count like sign-in attempts.
 */
async function reauthenticate(
  current: CurrentSession,
  { code, password }: { readonly code: string; readonly password?: string },
  context: AttemptContext,
  deps: AuthDependencies,
): Promise<Result<Verified>> {
  const found = await deps.users.findById(current.userId);
  if (!found.ok || found.data === undefined) {
    return found.ok ? ok({ status: "refused" }) : found;
  }
  const user = found.data;
  const steps = [
    ...(password === undefined
      ? []
      : [() => checkPasswordStep(user, password, context, deps)]),
    () => checkCodeStep(user, code, context, deps),
  ];
  for (const step of steps) {
    const outcome = await step();
    if (!outcome.ok) {
      return outcome;
    }
    if (outcome.data !== "verified") {
      return ok({ status: outcome.data });
    }
  }
  return ok({ status: "verified", user });
}

/**
 * New recovery codes: information used to recover the account, so the owner
 * re-authenticates fully, password and TOTP code (ASVS 7.5.1).
 */
export async function regenerateRecoveryCodes(
  proof: { readonly password: string; readonly code: string },
  current: CurrentSession,
  context: AttemptContext,
  deps: AuthDependencies,
): Promise<
  Result<
    { status: Refusal } | { status: "done"; recoveryCodes: readonly string[] }
  >
> {
  const verified = await reauthenticate(current, proof, context, deps);
  if (!verified.ok) {
    return verified;
  }
  if (verified.data.status !== "verified") {
    return ok({ status: verified.data.status });
  }
  const codes = await issueRecoveryCodes(current.userId, deps);
  if (!codes.ok) {
    return codes;
  }
  await deps.audit.record({
    actorId: current.userId,
    action: "auth.recovery_codes_regenerated",
    ...auditContext(context),
  });
  return ok({ status: "done", recoveryCodes: codes.data });
}

export interface PasswordChange {
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly code: string;
}

export type PasswordChangeOutcome =
  | { readonly status: Refusal }
  | {
      readonly status: "invalid";
      readonly problem: PasswordProblem | "breached";
    }
  | { readonly status: "done"; readonly revoked: number };

/** A breached password is refused; if the check is down, the change goes through, logged. */
async function isBreached(
  password: string,
  deps: AuthDependencies,
): Promise<boolean> {
  const breached = await deps.isBreached(password);
  if (!breached.ok) {
    logger.warn("auth.breach_check_unavailable");
  }
  return breached.ok && breached.data;
}

/**
 * Changes the password, then signs out every other session (ASVS). The new
 * password's length and words are checked first, before a TOTP code (good
 * once) is spent.
 */
export async function changePassword(
  change: PasswordChange,
  current: CurrentSession,
  context: AttemptContext,
  deps: AuthDependencies,
): Promise<Result<PasswordChangeOutcome>> {
  const policy = checkPasswordPolicy(change.newPassword, current.email);
  if (!policy.ok) {
    return ok({ status: "invalid", problem: policy.error });
  }
  const verified = await reauthenticate(
    current,
    { code: change.code, password: change.currentPassword },
    context,
    deps,
  );
  if (!verified.ok) {
    return verified;
  }
  if (verified.data.status !== "verified") {
    return ok({ status: verified.data.status });
  }
  const { user } = verified.data;
  if (await isBreached(change.newPassword, deps)) {
    return ok({ status: "invalid", problem: "breached" });
  }
  const updated = await deps.users.updatePassword(
    user.id,
    await hashPassword(change.newPassword),
  );
  const revoked = updated.ok
    ? await deps.sessions.deleteForUser(user.id, current.sessionId)
    : updated;
  if (!revoked.ok) {
    return revoked;
  }
  await deps.audit.record({
    actorId: user.id,
    action: "auth.password_changed",
    diff: { revokedCount: revoked.data },
    ...auditContext(context),
  });
  return ok({ status: "done", revoked: revoked.data });
}

export interface SessionRevocation {
  readonly code: string;
  /** The sessions chosen; ids of another account are ignored. */
  readonly sessionIds: readonly string[];
  /** Every session but the current one, whatever was chosen (ASVS 7.4.3). */
  readonly others: boolean;
}

export type RevocationOutcome =
  | { readonly status: Refusal }
  | {
      readonly status: "done";
      readonly revoked: number;
      /** The current session was among them: the caller signs out. */
      readonly signedOut: boolean;
    };

/** Revokes sessions after a TOTP code (ASVS 7.5.2): a stolen session cannot lock the owner out. */
export async function revokeSessions(
  { code, sessionIds, others }: SessionRevocation,
  current: CurrentSession,
  context: AttemptContext,
  deps: AuthDependencies,
): Promise<Result<RevocationOutcome>> {
  const verified = await reauthenticate(current, { code }, context, deps);
  if (!verified.ok) {
    return verified;
  }
  if (verified.data.status !== "verified") {
    return ok({ status: verified.data.status });
  }
  const deleted = others
    ? await deps.sessions.deleteForUser(current.userId, current.sessionId)
    : await deps.sessions.deleteOwned(sessionIds, current.userId);
  if (!deleted.ok) {
    return deleted;
  }
  await deps.audit.record({
    actorId: current.userId,
    action: "auth.session_revoked",
    diff: {
      revokedCount: deleted.data,
      scope: others ? "others" : "selected",
    },
    ...auditContext(context),
  });
  return ok({
    status: "done",
    revoked: deleted.data,
    signedOut: !others && sessionIds.includes(current.sessionId),
  });
}

export async function signOut(
  current: CurrentSession,
  context: AttemptContext,
  deps: AuthDependencies,
): Promise<Result<void>> {
  const deleted = await deps.sessions.delete(current.sessionId);
  if (deleted.ok) {
    await deps.audit.record({
      actorId: current.userId,
      action: "auth.signed_out",
      ...auditContext(context),
    });
  }
  return deleted;
}
