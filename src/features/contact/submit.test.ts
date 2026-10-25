import { describe, expect, it, vi } from "vitest";

import { err, ok } from "@/lib/result";

import type { ContactConfig } from "./config";
import { HONEYPOT_FIELD } from "./form-state";
import { handleContactSubmission, type ContactDependencies } from "./submit";

const CONFIG: ContactConfig = {
  enabled: true,
  turnstile: { siteKey: "site", secretKey: "secret" },
  ipHashSalt: "s".repeat(32),
  upstash: undefined,
  mail: { apiKey: "re_1", to: "owner@example.com", from: "Portfolio <x@y.z>" },
};

const VALUES = {
  name: "Ada",
  email: "ada@example.com",
  subject: "Une mission",
  message: "Bonjour, j'ai un projet à vous proposer.",
};

const FIELDS = {
  ...VALUES,
  [HONEYPOT_FIELD]: "",
  "cf-turnstile-response": "token",
};

function dependencies(overrides: Partial<ContactDependencies> = {}) {
  const tasks: (() => Promise<unknown>)[] = [];
  const deps: ContactDependencies = {
    config: CONFIG,
    verifyToken: vi.fn(() => Promise.resolve(true)),
    allow: vi.fn(() => Promise.resolve(true)),
    store: vi.fn(() => Promise.resolve(ok(undefined))),
    notify: vi.fn(() => Promise.resolve(ok(undefined))),
    schedule: (task) => {
      tasks.push(task);
    },
    ...overrides,
  };
  return { deps, runScheduled: () => Promise.all(tasks.map((task) => task())) };
}

function submit(fields: Record<string, unknown>, deps: ContactDependencies) {
  return handleContactSubmission(
    { fields, ip: "203.0.113.7", userAgent: "Mozilla/5.0", locale: "en" },
    deps,
  );
}

describe("handleContactSubmission", () => {
  it("stores a valid message, then notifies once the response is sent", async () => {
    const { deps, runScheduled } = dependencies();

    expect(await submit(FIELDS, deps)).toEqual({ status: "sent" });

    expect(deps.verifyToken).toHaveBeenCalledWith("token");
    expect(deps.store).toHaveBeenCalledWith({
      name: "Ada",
      email: "ada@example.com",
      subject: "Une mission",
      message: "Bonjour, j'ai un projet à vous proposer.",
      locale: "en",
      ipHash: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown,
      userAgent: "Mozilla/5.0",
    });
    expect(deps.notify).not.toHaveBeenCalled();
    await runScheduled();
    expect(deps.notify).toHaveBeenCalledOnce();
  });

  it("never stores the sender's address, only its keyed hash", async () => {
    const { deps } = dependencies();

    await submit(FIELDS, deps);

    expect(JSON.stringify(vi.mocked(deps.store).mock.calls)).not.toContain(
      "203.0.113.7",
    );
    expect(deps.allow).toHaveBeenCalledWith(
      vi.mocked(deps.store).mock.calls[0]?.[0].ipHash,
    );
  });

  it("counts the addresses of one IPv6 /64 as a single sender", async () => {
    const { deps } = dependencies();
    const from = (ip: string) =>
      handleContactSubmission(
        { fields: FIELDS, ip, userAgent: null, locale: "fr" },
        deps,
      );

    await from("2001:db8:1:2::1");
    await from("2001:db8:1:2::ffff");
    await from("2001:db8:1:3::1");

    const keys = vi.mocked(deps.allow).mock.calls.map(([key]) => key);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("answers a filled honeypot like a success, and drops the message", async () => {
    const { deps } = dependencies();

    expect(
      await submit(
        { ...FIELDS, [HONEYPOT_FIELD]: "https://spam.example" },
        deps,
      ),
    ).toEqual({
      status: "sent",
    });
    expect(deps.verifyToken).not.toHaveBeenCalled();
    expect(deps.store).not.toHaveBeenCalled();
  });

  it("returns the invalid fields without asking any service", async () => {
    const { deps } = dependencies();

    expect(
      await submit({ ...FIELDS, email: "nope", message: "" }, deps),
    ).toEqual({
      status: "invalid",
      errors: { email: "invalid", message: "required" },
      values: { ...VALUES, email: "nope", message: "" },
    });
    expect(deps.verifyToken).not.toHaveBeenCalled();
  });

  it("refuses a message without a genuine Turnstile token, before counting it", async () => {
    const { deps } = dependencies({
      verifyToken: vi.fn(() => Promise.resolve(false)),
    });

    expect(await submit(FIELDS, deps)).toEqual({
      status: "failed",
      reason: "captcha",
      values: VALUES,
    });
    expect(deps.allow).not.toHaveBeenCalled();
    expect(deps.store).not.toHaveBeenCalled();
  });

  it("refuses a sender over the rate limit", async () => {
    const { deps } = dependencies({
      allow: vi.fn(() => Promise.resolve(false)),
    });

    expect(await submit(FIELDS, deps)).toEqual({
      status: "failed",
      reason: "rate_limited",
      values: VALUES,
    });
    expect(deps.store).not.toHaveBeenCalled();
  });

  it("reports the outage when the message cannot be stored, and notifies nobody", async () => {
    const { deps, runScheduled } = dependencies({
      store: vi.fn(() =>
        Promise.resolve(err({ code: "DB_UNAVAILABLE", message: "down" })),
      ),
    });

    expect(await submit(FIELDS, deps)).toEqual({
      status: "failed",
      reason: "unavailable",
      values: VALUES,
    });
    await runScheduled();
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it("keeps a stored message a success when the notification fails", async () => {
    const { deps, runScheduled } = dependencies({
      notify: vi.fn(() =>
        Promise.resolve(err({ code: "MAIL_FAILED", message: "x" })),
      ),
    });

    expect(await submit(FIELDS, deps)).toEqual({ status: "sent" });
    await runScheduled();
    expect(deps.store).toHaveBeenCalledOnce();
  });

  it("schedules no notification when no mail service is configured", async () => {
    const { deps, runScheduled } = dependencies({
      config: { ...CONFIG, mail: undefined },
    });

    await submit(FIELDS, deps);
    await runScheduled();

    expect(deps.notify).not.toHaveBeenCalled();
  });

  it("is unavailable while the anti-abuse services are not configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { deps } = dependencies({
      config: { enabled: false, missing: ["TURNSTILE_SECRET_KEY"] },
    });

    expect(await submit(FIELDS, deps)).toEqual({
      status: "failed",
      reason: "unavailable",
      values: VALUES,
    });
    expect(deps.store).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("echoes the typed text only, so a refused form keeps it", async () => {
    const { deps } = dependencies({
      verifyToken: vi.fn(() => Promise.resolve(false)),
    });

    const state = await submit(
      { ...FIELDS, name: "  Ada  ", subject: 42, extra: "x" },
      deps,
    );

    // React empties the form after an action: these values refill it, as typed.
    expect(state).toMatchObject({
      values: { ...VALUES, name: "  Ada  ", subject: "" },
    });
    expect(JSON.stringify(state)).not.toContain("token");
    expect(JSON.stringify(state)).not.toContain('"extra"');
  });

  it("stores an unknown locale as the default one, and caps the user agent", async () => {
    const { deps } = dependencies();

    await handleContactSubmission(
      {
        fields: FIELDS,
        ip: "203.0.113.7",
        userAgent: "x".repeat(2000),
        locale: "de",
      },
      deps,
    );

    expect(deps.store).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "fr", userAgent: "x".repeat(512) }),
    );
  });
});
