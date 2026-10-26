import { ok, type Result } from "@/lib/result";

import {
  auditContext,
  beginAttempt,
  completeSignIn,
  failAttempt,
  type AttemptContext,
  type SignedInOutcome,
} from "./attempts";
import type { AuthDependencies } from "./auth-dependencies";
import { hashRecoveryCode, normalizeRecoveryCode } from "./recovery-codes";
import { acceptTotpCode } from "./totp-code";
import type { AdminUserRecord } from "./users-repository";

export type SecondFactor =
  | { readonly kind: "totp"; readonly code: string }
  | { readonly kind: "recovery_code"; readonly code: string };

/** The session acting, as the DAL reported it. */
export interface PartialSession {
  readonly sessionId: string;
  readonly userId: string;
}

async function isAccepted(
  factor: SecondFactor,
  user: AdminUserRecord,
  deps: AuthDependencies,
): Promise<Result<boolean>> {
  if (factor.kind === "totp") {
    return acceptTotpCode(user, factor.code, deps);
  }
  const normalized = normalizeRecoveryCode(factor.code);
  return normalized === undefined
    ? ok(false)
    : deps.recoveryCodes.consume(user.id, hashRecoveryCode(normalized));
}

/**
 * The second step: a TOTP code, or a one-time recovery code. Each attempt is
 * counted before it is checked; TOTP codes also count against the account
 * from every network. Once a lock runs, the partial session ends and the next
 * attempt starts from the password again.
 */
export async function verifySecondFactor(
  factor: SecondFactor,
  current: PartialSession,
  context: AttemptContext,
  deps: AuthDependencies,
): Promise<Result<SignedInOutcome>> {
  const found = await deps.users.findById(current.userId);
  if (!found.ok) {
    return found;
  }
  const user = found.data;
  // Gone, or without a second factor (signIn never opens such a session).
  if (user === undefined || user.totpEnabledAt === null) {
    return ok({ status: "refused" });
  }
  const attempt = await beginAttempt(deps, context, {
    email: user.email,
    isTotp: factor.kind === "totp",
  });
  if (!attempt.ok) {
    return attempt;
  }
  if (attempt.data.status === "locked") {
    await deps.sessions.delete(current.sessionId);
    return ok({ status: "locked" });
  }
  const { reservation } = attempt.data;
  const accepted = await isAccepted(factor, user, deps);
  if (!accepted.ok) {
    return accepted;
  }
  if (!accepted.data) {
    const refusal = failAttempt(deps, context, {
      reservation,
      user,
      step: factor.kind,
    });
    if (refusal === "locked") {
      await deps.sessions.delete(current.sessionId);
    }
    return ok({ status: refusal });
  }
  if (factor.kind === "recovery_code") {
    await deps.audit.record({
      actorId: user.id,
      action: "auth.recovery_code_used",
      ...auditContext(context),
    });
  }
  return completeSignIn(deps, context, {
    user,
    reservation,
    partialSessionId: current.sessionId,
    method: factor.kind,
  });
}
