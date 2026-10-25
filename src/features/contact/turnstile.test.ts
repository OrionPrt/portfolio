import { afterEach, describe, expect, it, vi } from "vitest";

import { TURNSTILE_TEST_KEYS } from "./config";
import { verifyTurnstileToken } from "./turnstile";

function answering(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  );
}

describe("verifyTurnstileToken", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks Cloudflare and accepts a valid token", async () => {
    const fetchImpl = answering({ success: true, action: "contact" });

    const valid = await verifyTurnstileToken({
      token: "tok",
      secretKey: "secret",
      fetchImpl,
    });

    expect(valid).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    expect(init?.method).toBe("POST");
    expect((init?.body as URLSearchParams).toString()).toBe(
      "secret=secret&response=tok",
    );
  });

  it.each([
    [
      "rejected by Cloudflare",
      { success: false, "error-codes": ["invalid-input-response"] },
    ],
    ["issued for another action", { success: true, action: "login" }],
    ["that names no action", { success: true, action: "" }],
    ["without an action", { success: true }],
    ["answered with an unexpected shape", { ok: true }],
  ])("refuses a token %s", async (_label, body) => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    expect(
      await verifyTurnstileToken({
        token: "tok",
        secretKey: "s",
        fetchImpl: answering(body),
      }),
    ).toBe(false);
  });

  it("accepts the test secret's tokens, which carry no action", async () => {
    expect(
      await verifyTurnstileToken({
        token: "XXXX.DUMMY.TOKEN.XXXX",
        secretKey: TURNSTILE_TEST_KEYS.secretKey,
        fetchImpl: answering({ success: true, action: "" }),
      }),
    ).toBe(true);
  });

  it.each([
    ["", 0],
    ["x".repeat(2049), 0],
  ])("refuses an empty or oversized token without asking", async (token) => {
    const fetchImpl = answering({ success: true });

    expect(
      await verifyTurnstileToken({ token, secretKey: "s", fetchImpl }),
    ).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses, and logs, when Cloudflare cannot be reached", async () => {
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.reject(new Error("timeout")),
    );

    expect(
      await verifyTurnstileToken({ token: "tok", secretKey: "s", fetchImpl }),
    ).toBe(false);
    expect(String(consoleWarn.mock.calls[0]?.[0])).toContain(
      "contact.turnstile_unavailable",
    );
  });
});
