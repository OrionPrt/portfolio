import { ok, type Result } from "@/lib/result";

import { isSessionLive, needsTouch, sessionExpiry } from "./session-policy";
import {
  generateSessionToken,
  isWellFormedSessionToken,
  sessionIdOf,
} from "./session-token";
import type { SessionsRepository } from "./sessions-repository";
import type { AdminUserRecord } from "./users-repository";
import type { SessionStage } from "./vocabulary";

export type SessionStore = Pick<
  SessionsRepository,
  "create" | "findWithUser" | "touch" | "delete"
>;

interface StartSessionInput {
  readonly userId: string;
  readonly stage: SessionStage;
  readonly now: Date;
  readonly ipHash: string | null;
  readonly userAgent: string | null;
}

export interface StartedSession {
  /** Goes into the cookie, and nowhere else. */
  readonly token: string;
  readonly expiresAt: Date;
}

/** A new session, with a new token: login steps never reuse one (fixation). */
export async function startSession(
  store: Pick<SessionStore, "create">,
  { userId, stage, now, ipHash, userAgent }: StartSessionInput,
): Promise<Result<StartedSession>> {
  const token = generateSessionToken();
  const expiresAt = sessionExpiry(stage, now);
  const created = await store.create({
    id: sessionIdOf(token),
    userId,
    stage,
    createdAt: now,
    expiresAt,
    ipHash,
    userAgent,
  });
  return created.ok ? ok({ token, expiresAt }) : created;
}

export interface ValidSession {
  readonly sessionId: string;
  readonly stage: SessionStage;
  readonly expiresAt: Date;
  readonly user: AdminUserRecord;
}

/**
 * The session a cookie's token opens, if it is still live. An expired or idle
 * session is deleted on sight; activity is recorded at most once a minute.
 */
export async function validateSessionToken(
  store: SessionStore,
  token: string,
  now: Date,
): Promise<Result<ValidSession | undefined>> {
  if (!isWellFormedSessionToken(token)) {
    return ok(undefined);
  }
  const sessionId = sessionIdOf(token);
  const found = await store.findWithUser(sessionId);
  if (!found.ok || found.data === undefined) {
    return found.ok ? ok(undefined) : found;
  }
  const { session, user } = found.data;
  if (!isSessionLive(session, now)) {
    await store.delete(sessionId);
    return ok(undefined);
  }
  if (needsTouch(session.lastSeenAt, now)) {
    await store.touch(sessionId, now);
  }
  return ok({
    sessionId,
    stage: session.stage,
    expiresAt: session.expiresAt,
    user,
  });
}
