import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  headers: new Headers(),
  after: vi.fn<(task: () => unknown) => void>(),
  sendMail: vi.fn(() => Promise.resolve({ ok: true, data: undefined })),
}));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ set: mocks.set, get: mocks.get }),
  headers: () => Promise.resolve(mocks.headers),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/mail", () => ({ sendMail: mocks.sendMail }));

import { authDependencies } from "./dependencies";
import { requestContext } from "./request-context";
import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
} from "./session-cookie";

const CONFIG = {
  enabled: true as const,
  sealingKey: new Uint8Array(32),
  ipHashSalt: "s".repeat(32),
  alertMail: { apiKey: "re_1", to: "owner@example.com", from: "x@y.z" },
};

describe("session cookie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is __Host-, HttpOnly, Secure and SameSite=Strict, until the session ends", async () => {
    const expires = new Date("2026-10-25T20:00:00Z");

    await setSessionCookie("token", expires);

    expect(mocks.set).toHaveBeenCalledWith("__Host-session", "token", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      expires,
    });
  });

  it("is cleared with the same attributes, or the browser keeps it", async () => {
    await clearSessionCookie();

    expect(mocks.set).toHaveBeenCalledWith("__Host-session", "", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
  });

  it("reads the token, if any", async () => {
    mocks.get
      .mockReturnValueOnce({ value: "token" })
      .mockReturnValueOnce(undefined);

    expect(await readSessionToken()).toBe("token");
    expect(await readSessionToken()).toBeUndefined();
  });
});

describe("requestContext", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the network in memory and stores only its keyed hash", async () => {
    // Behind Vercel's edge, the only place X-Forwarded-For is trusted.
    vi.stubEnv("VERCEL", "1");
    mocks.headers = new Headers({
      "x-forwarded-for": "2001:db8:1:2::7",
      "user-agent": "x".repeat(600),
      origin: "https://orion.dev",
      host: "orion.dev",
    });

    const context = await requestContext("s".repeat(32));

    expect(context.network).toBe("2001:db8:1:2::/64");
    expect(context.networkHash).toMatch(/^[0-9a-f]{64}$/);
    expect(context.userAgent).toHaveLength(512);
    expect(context.isSameOrigin).toBe(true);
  });
});

describe("authDependencies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emails a lockout alert after the response", async () => {
    const deps = authDependencies({} as never, CONFIG);

    deps.alertLockout({ at: new Date(), until: new Date() });
    expect(mocks.sendMail).not.toHaveBeenCalled();
    await mocks.after.mock.calls[0]?.[0]();

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ mail: CONFIG.alertMail, event: "auth" }),
    );
  });

  it("only logs the lockout when no mail service is configured", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const deps = authDependencies({} as never, {
      ...CONFIG,
      alertMail: undefined,
    });

    deps.alertLockout({ at: new Date(), until: new Date() });

    expect(mocks.after).not.toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toContain(
      "auth.lockout_alert_skipped",
    );
    expect(deps.now()).toBeInstanceOf(Date);
  });
});
