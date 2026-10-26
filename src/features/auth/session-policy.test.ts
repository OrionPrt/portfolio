import { describe, expect, it } from "vitest";

import { isSessionLive, needsTouch, sessionExpiry } from "./session-policy";

const NOW = new Date("2026-10-25T12:00:00Z");
const minutes = (count: number) => count * 60_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const later = (ms: number) => new Date(NOW.getTime() + ms);

describe("sessionExpiry", () => {
  it.each([
    ["signed_in", minutes(8 * 60)],
    ["totp_challenge", minutes(5)],
  ] as const)("gives a %s session %i ms", (stage, lifetime) => {
    expect(sessionExpiry(stage, NOW)).toEqual(later(lifetime));
  });
});

describe("isSessionLive", () => {
  it("keeps a recent session", () => {
    expect(
      isSessionLive(
        {
          stage: "signed_in",
          expiresAt: later(minutes(60)),
          lastSeenAt: ago(minutes(29)),
        },
        NOW,
      ),
    ).toBe(true);
  });

  it("ends a signed-in session idle for 30 minutes", () => {
    expect(
      isSessionLive(
        {
          stage: "signed_in",
          expiresAt: later(minutes(60)),
          lastSeenAt: ago(minutes(30)),
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("ends any session at its expiry, however active", () => {
    expect(
      isSessionLive(
        { stage: "signed_in", expiresAt: NOW, lastSeenAt: NOW },
        NOW,
      ),
    ).toBe(false);
  });

  it("lets the second step run until its own short expiry, however idle", () => {
    expect(
      isSessionLive(
        {
          stage: "totp_challenge",
          expiresAt: later(1000),
          lastSeenAt: ago(minutes(4)),
        },
        NOW,
      ),
    ).toBe(true);
  });
});

describe("needsTouch", () => {
  it("records activity at most once a minute", () => {
    expect(needsTouch(ago(59_000), NOW)).toBe(false);
    expect(needsTouch(ago(60_000), NOW)).toBe(true);
  });
});
