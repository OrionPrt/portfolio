import { describe, expect, it, vi } from "vitest";

import { err, ok } from "@/lib/result";

import {
  startSession,
  validateSessionToken,
  type SessionStore,
} from "./session-service";
import { sessionIdOf } from "./session-token";
import type { AdminSessionRecord } from "./sessions-repository";
import type { AdminUserRecord } from "./users-repository";

const NOW = new Date("2026-10-25T12:00:00Z");
const USER = { id: "user-1", email: "admin@example.com" } as AdminUserRecord;

function store(session?: Partial<AdminSessionRecord>): SessionStore {
  return {
    create: vi.fn(() => Promise.resolve(ok(undefined))),
    findWithUser: vi.fn(() =>
      Promise.resolve(
        ok(
          session === undefined
            ? undefined
            : {
                session: {
                  id: "id",
                  userId: USER.id,
                  stage: "signed_in" as const,
                  createdAt: NOW,
                  lastSeenAt: NOW,
                  expiresAt: new Date(NOW.getTime() + 3_600_000),
                  ipHash: null,
                  userAgent: null,
                  ...session,
                },
                user: USER,
              },
        ),
      ),
    ),
    touch: vi.fn(() => Promise.resolve(ok(undefined))),
    delete: vi.fn(() => Promise.resolve(ok(undefined))),
  };
}

describe("startSession", () => {
  it("stores only the token's hash, with the stage's lifetime", async () => {
    const sessions = store();

    const started = await startSession(sessions, {
      userId: USER.id,
      stage: "totp_challenge",
      now: NOW,
      ipHash: null,
      userAgent: "Mozilla/5.0",
    });

    expect(started.ok).toBe(true);
    const { token, expiresAt } = started.ok
      ? started.data
      : { token: "", expiresAt: NOW };
    expect(expiresAt).toEqual(new Date(NOW.getTime() + 5 * 60_000));
    expect(sessions.create).toHaveBeenCalledWith({
      id: sessionIdOf(token),
      userId: USER.id,
      stage: "totp_challenge",
      createdAt: NOW,
      expiresAt,
      ipHash: null,
      userAgent: "Mozilla/5.0",
    });
    expect(JSON.stringify(vi.mocked(sessions.create).mock.calls)).not.toContain(
      token,
    );
  });
});

describe("validateSessionToken", () => {
  const token = "a".repeat(52);

  it("returns the live session and its account", async () => {
    expect(await validateSessionToken(store({}), token, NOW)).toEqual({
      ok: true,
      data: {
        sessionId: sessionIdOf(token),
        stage: "signed_in",
        expiresAt: new Date(NOW.getTime() + 3_600_000),
        user: USER,
      },
    });
  });

  it("looks nothing up for a malformed token", async () => {
    const sessions = store({});

    expect(await validateSessionToken(sessions, "not a token", NOW)).toEqual(
      ok(undefined),
    );
    expect(sessions.findWithUser).not.toHaveBeenCalled();
  });

  it("deletes a session left idle for 30 minutes", async () => {
    const sessions = store({
      lastSeenAt: new Date(NOW.getTime() - 30 * 60_000),
    });

    expect(await validateSessionToken(sessions, token, NOW)).toEqual(
      ok(undefined),
    );
    expect(sessions.delete).toHaveBeenCalledWith(sessionIdOf(token));
  });

  it("records activity at most once a minute", async () => {
    const recent = store({ lastSeenAt: new Date(NOW.getTime() - 30_000) });
    const older = store({ lastSeenAt: new Date(NOW.getTime() - 90_000) });

    await validateSessionToken(recent, token, NOW);
    await validateSessionToken(older, token, NOW);

    expect(recent.touch).not.toHaveBeenCalled();
    expect(older.touch).toHaveBeenCalledWith(sessionIdOf(token), NOW);
  });

  it("passes a database failure on, so callers fail closed", async () => {
    const sessions = {
      ...store(),
      findWithUser: vi.fn(() =>
        Promise.resolve(err({ code: "DB_UNAVAILABLE", message: "down" })),
      ),
    };

    expect(await validateSessionToken(sessions, token, NOW)).toMatchObject({
      ok: false,
    });
  });
});
