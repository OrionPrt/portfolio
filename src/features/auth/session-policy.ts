import type { SessionStage } from "./vocabulary";

const MINUTE_MS = 60_000;

/**
 * How long each kind of session lasts. A signed-in session ends after 8
 * hours, or 30 minutes without activity; the second login step only lasts
 * minutes.
 */
export const SESSION_POLICY: Readonly<
  Record<
    SessionStage,
    { readonly lifetimeMs: number; readonly idleMs?: number }
  >
> = {
  totp_challenge: { lifetimeMs: 5 * MINUTE_MS },
  signed_in: { lifetimeMs: 8 * 60 * MINUTE_MS, idleMs: 30 * MINUTE_MS },
};

/** Activity is recorded at most this often, not on every request. */
const TOUCH_INTERVAL_MS = MINUTE_MS;

export interface SessionTimes {
  readonly stage: SessionStage;
  readonly expiresAt: Date;
  readonly lastSeenAt: Date;
}

export function sessionExpiry(stage: SessionStage, now: Date): Date {
  return new Date(now.getTime() + SESSION_POLICY[stage].lifetimeMs);
}

export function isSessionLive(session: SessionTimes, now: Date): boolean {
  const { idleMs } = SESSION_POLICY[session.stage];
  const isIdle =
    idleMs !== undefined &&
    now.getTime() - session.lastSeenAt.getTime() >= idleMs;
  return now < session.expiresAt && !isIdle;
}

export function needsTouch(lastSeenAt: Date, now: Date): boolean {
  return now.getTime() - lastSeenAt.getTime() >= TOUCH_INTERVAL_MS;
}
