import { describe, expect, it, vi } from "vitest";

import { ok } from "@/lib/result";

import type { ContactConfig } from "./config";

const mocks = vi.hoisted(() => ({
  config: vi.fn<() => ContactConfig>(),
  after: vi.fn<(task: () => Promise<unknown>) => void>(),
  verify: vi.fn(() => Promise.resolve(true)),
  notify: vi.fn(() => Promise.resolve({ ok: true as const, data: undefined })),
  withDatabase: vi.fn(() =>
    Promise.resolve({ ok: true as const, data: undefined }),
  ),
}));

vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/db/client", () => ({ withDatabase: mocks.withDatabase }));
vi.mock("./config", () => ({ contactConfig: mocks.config }));
vi.mock("./turnstile", () => ({ verifyTurnstileToken: mocks.verify }));
vi.mock("./notify", () => ({ sendContactNotification: mocks.notify }));

import { contactDependencies } from "./dependencies";

const MAIL = { apiKey: "re_1", to: "owner@example.com", from: "x@y.z" };

const ENABLED: ContactConfig = {
  enabled: true,
  turnstile: { siteKey: "site", secretKey: "secret" },
  ipHashSalt: "s".repeat(32),
  upstash: undefined,
  mail: MAIL,
};

const MESSAGE = {
  name: "Ada",
  email: "ada@example.com",
  subject: "Une mission",
  message: "Bonjour, j'ai un projet.",
  locale: "fr" as const,
  ipHash: "a".repeat(64),
  userAgent: null,
};

describe("contactDependencies", () => {
  it("wires Turnstile, storage, mail and Next.js `after`", async () => {
    mocks.config.mockReturnValue(ENABLED);
    const deps = contactDependencies();
    const task = () => Promise.resolve();

    await deps.verifyToken("token");
    await deps.store(MESSAGE);
    await deps.notify(MESSAGE);
    deps.schedule(task);

    expect(mocks.verify).toHaveBeenCalledWith({
      token: "token",
      secretKey: "secret",
    });
    expect(mocks.withDatabase).toHaveBeenCalledOnce();
    expect(mocks.notify).toHaveBeenCalledWith({ message: MESSAGE, mail: MAIL });
    expect(mocks.after).toHaveBeenCalledWith(task);
  });

  it("keeps one rate limiter per instance, across requests", async () => {
    mocks.config.mockReturnValue(ENABLED);
    const first = contactDependencies();
    const second = contactDependencies();

    for (let attempt = 0; attempt < 5; attempt++) {
      await first.allow("sender");
    }

    expect(await second.allow("sender")).toBe(false);
  });

  it("verifies nothing and notifies nobody while disabled", async () => {
    mocks.config.mockReturnValue({ enabled: false, missing: ["IP_HASH_SALT"] });
    mocks.verify.mockClear();
    mocks.notify.mockClear();
    const deps = contactDependencies();

    expect(await deps.verifyToken("token")).toBe(false);
    expect(await deps.notify(MESSAGE)).toEqual(ok(undefined));
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
