import { logger } from "@/lib/logger";
import { ok, type Result } from "@/lib/result";

import {
  beginAttempt,
  failAttempt,
  type AttemptContext,
  type Refusal,
} from "./attempts";
import type { AuthDependencies } from "./auth-dependencies";
import {
  PASSWORD_LIMITS,
  verifyDummyPassword,
  verifyPassword,
} from "./password";
import { startSession, type StartedSession } from "./session-service";
import { refundAttempt } from "./throttle-service";
import type { AdminUserRecord } from "./users-repository";

export interface SignInInput {
  readonly email: string;
  readonly password: string;
  /** The session the browser still holds, ended on success (ASVS 7.2.4). */
  readonly previousSessionId?: string;
}

export type SignInOutcome =
  | { readonly status: Refusal }
  | { readonly status: "next"; readonly session: StartedSession };

/** Above this many UTF-16 units no password is valid: refused before any hashing. */
const MAX_PASSWORD_UNITS = PASSWORD_LIMITS.max * 4;
const MAX_EMAIL_LENGTH = 254;

async function checkPassword(
  user: AdminUserRecord | undefined,
  password: string,
): Promise<boolean> {
  // The same work for an unknown email: timing does not reveal accounts.
  return user === undefined
    ? verifyDummyPassword(password)
    : verifyPassword(user.passwordHash, password);
}

/**
 * The password step. A success opens a 5-minute partial session that only
 * reaches the second factor; the second factor itself is set up in the CLI,
 * so an account without one cannot sign in at all.
 */
export async function signIn(
  { email, password, previousSessionId }: SignInInput,
  context: AttemptContext,
  deps: AuthDependencies,
): Promise<Result<SignInOutcome>> {
  if (email.length > MAX_EMAIL_LENGTH || password.length > MAX_PASSWORD_UNITS) {
    return ok({ status: "refused" });
  }
  const attempt = await beginAttempt(deps, context, { email, isTotp: false });
  if (!attempt.ok || attempt.data.status === "locked") {
    return attempt.ok ? ok({ status: "locked" }) : attempt;
  }
  const { reservation } = attempt.data;
  const found = await deps.users.findByEmail(email);
  if (!found.ok) {
    return found;
  }
  const user = found.data;
  if (!(await checkPassword(user, password)) || user === undefined) {
    return ok({
      status: failAttempt(deps, context, {
        reservation,
        user,
        step: "password",
      }),
    });
  }
  await refundAttempt(deps.throttles, reservation);
  if (user.totpEnabledAt === null) {
    logger.warn("auth.totp_not_enrolled");
    return ok({ status: "refused" });
  }
  const now = deps.now();
  await deps.sessions.deleteExpired(now);
  if (previousSessionId !== undefined) {
    await deps.sessions.delete(previousSessionId);
  }
  const session = await startSession(deps.sessions, {
    userId: user.id,
    stage: "totp_challenge",
    now,
    ipHash: context.networkHash,
    userAgent: context.userAgent,
  });
  return session.ok ? ok({ status: "next", session: session.data }) : session;
}
