import { beforeEach, describe, expect, it, vi } from "vitest";

import { ok } from "@/lib/result";

const mocks = vi.hoisted(() => ({
  token: undefined as string | undefined,
  validation: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: () => Promise.resolve() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("./session-cookie", () => ({
  readSessionToken: () => Promise.resolve(mocks.token),
}));
vi.mock("@/db/client", () => ({
  withDatabase: (read: (db: unknown) => unknown) => read({}),
}));
vi.mock("./session-service", () => ({
  validateSessionToken: mocks.validation,
}));

import { getAdminSession, requireAdmin, requireLoginStep } from "./dal";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  passwordHash: "$argon2id$secret",
  totpSecret: "v1.secret",
  totpEnabledAt: new Date(),
};

function sessionAt(stage: string) {
  return ok({ sessionId: "id", stage, expiresAt: new Date(), user: USER });
}

describe("admin DAL", () => {
  beforeEach(() => {
    mocks.token = "a".repeat(52);
    mocks.validation.mockReset();
  });

  it("returns a narrow view of the session, without hash or secret", async () => {
    mocks.validation.mockResolvedValue(sessionAt("signed_in"));

    const session = await getAdminSession();

    expect(session).toEqual({
      sessionId: "id",
      stage: "signed_in",
      expiresAt: expect.any(Date) as unknown,
      user: { id: "user-1", email: "admin@example.com" },
    });
    expect(JSON.stringify(session)).not.toContain("secret");
  });

  it("has no session without a cookie, and never queries for one", async () => {
    mocks.token = undefined;

    expect(await getAdminSession()).toBeUndefined();
    expect(mocks.validation).not.toHaveBeenCalled();
  });

  it("has no session for an account without a second factor", async () => {
    mocks.validation.mockResolvedValue(
      ok({
        sessionId: "id",
        stage: "signed_in",
        expiresAt: new Date(),
        user: { ...USER, totpSecret: null, totpEnabledAt: null },
      }),
    );

    expect(await getAdminSession()).toBeUndefined();
    await expect(requireAdmin()).rejects.toThrow("redirect:/admin/login");
  });

  it("fails closed when the database cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.validation.mockResolvedValue({
      ok: false,
      error: { code: "DB_UNAVAILABLE", message: "down" },
    });

    expect(await getAdminSession()).toBeUndefined();
  });

  it("lets a signed-in admin through, and sends anyone else to the login", async () => {
    mocks.validation.mockResolvedValue(sessionAt("signed_in"));
    await expect(requireAdmin()).resolves.toMatchObject({ stage: "signed_in" });

    mocks.validation.mockResolvedValue(sessionAt("totp_challenge"));
    await expect(requireAdmin()).rejects.toThrow("redirect:/admin/login");

    mocks.validation.mockResolvedValue(ok(undefined));
    await expect(requireAdmin()).rejects.toThrow("redirect:/admin/login");
  });

  it("opens a login step only to a session at that step", async () => {
    mocks.validation.mockResolvedValue(sessionAt("totp_challenge"));
    await expect(requireLoginStep("totp_challenge")).resolves.toMatchObject({
      stage: "totp_challenge",
    });

    // A partial session never reaches the admin.
    await expect(requireAdmin()).rejects.toThrow("redirect:/admin/login");
  });
});
