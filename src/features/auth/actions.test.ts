import { beforeEach, describe, expect, it, vi } from "vitest";

import { err, ok } from "@/lib/result";

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  context: vi.fn(),
  database: vi.fn(),
  signIn: vi.fn(),
  verifySecondFactor: vi.fn(),
  signOut: vi.fn(),
  revokeSessions: vi.fn(),
  readToken: vi.fn<() => Promise<string | undefined>>(),
  regenerateRecoveryCodes: vi.fn(),
  changePassword: vi.fn(),
  session: vi.fn(),
  requireAdmin: vi.fn(),
  requireLoginStep: vi.fn(),
  setCookie: vi.fn(),
  clearCookie: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("./config", () => ({ authConfig: mocks.config }));
vi.mock("./request-context", () => ({ requestContext: mocks.context }));
vi.mock("@/db/client", () => ({ withDatabase: mocks.database }));
vi.mock("./dependencies", () => ({ authDependencies: () => ({}) }));
vi.mock("./sign-in", () => ({ signIn: mocks.signIn }));
vi.mock("./second-factor", () => ({
  verifySecondFactor: mocks.verifySecondFactor,
}));
vi.mock("./account-security", () => ({
  signOut: mocks.signOut,
  revokeSessions: mocks.revokeSessions,
  regenerateRecoveryCodes: mocks.regenerateRecoveryCodes,
  changePassword: mocks.changePassword,
}));
vi.mock("./dal", () => ({
  getAdminSession: mocks.session,
  requireAdmin: mocks.requireAdmin,
  requireLoginStep: mocks.requireLoginStep,
}));
vi.mock("./session-cookie", () => ({
  readSessionToken: mocks.readToken,
  setSessionCookie: mocks.setCookie,
  clearSessionCookie: mocks.clearCookie,
}));

import {
  changePasswordAction,
  regenerateCodesAction,
  revokeSessionsAction,
  secondFactorAction,
  signInAction,
  signOutAction,
} from "./actions";
import { IDLE } from "./form-state";

const SESSION_ID = "a".repeat(64);
const STARTED = {
  token: "t".repeat(52),
  expiresAt: new Date("2026-10-25T13:00:00Z"),
};

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.append(name, value);
  }
  return data;
}

describe("admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.config.mockReturnValue({
      enabled: true,
      sealingKey: new Uint8Array(32),
      ipHashSalt: "s".repeat(32),
      alertMail: undefined,
    });
    mocks.context.mockResolvedValue({
      network: "203.0.113.7",
      networkHash: "b".repeat(64),
      userAgent: null,
      isSameOrigin: true,
    });
    mocks.database.mockImplementation((run: (db: unknown) => unknown) =>
      run({}),
    );
    const session = {
      sessionId: SESSION_ID,
      stage: "signed_in",
      user: { id: "user-1", email: "admin@example.com" },
    };
    mocks.session.mockResolvedValue(session);
    mocks.requireAdmin.mockResolvedValue(session);
    mocks.requireLoginStep.mockResolvedValue({
      ...session,
      stage: "totp_challenge",
    });
  });

  describe("signInAction", () => {
    it("opens the second step: cookie set, then the matching page", async () => {
      mocks.signIn.mockResolvedValue(ok({ status: "next", session: STARTED }));

      await expect(
        signInAction(IDLE, form({ email: "admin@example.com", password: "p" })),
      ).rejects.toThrow("redirect:/admin/login/2fa");
      expect(mocks.setCookie).toHaveBeenCalledWith(
        STARTED.token,
        STARTED.expiresAt,
      );
    });

    it("ends the session the browser still held, if its cookie is well formed", async () => {
      mocks.readToken
        .mockResolvedValueOnce("a".repeat(52))
        .mockResolvedValueOnce("junk");
      mocks.signIn.mockResolvedValue(ok({ status: "refused" }));

      await signInAction(IDLE, form({}));
      await signInAction(IDLE, form({}));

      expect(mocks.signIn.mock.calls[0]?.[0]).toHaveProperty(
        "previousSessionId",
      );
      expect(mocks.signIn.mock.calls[1]?.[0]).not.toHaveProperty(
        "previousSessionId",
      );
    });

    it("keeps the email typed after a refusal", async () => {
      mocks.signIn.mockResolvedValue(ok({ status: "locked" }));

      expect(await signInAction(IDLE, form({ email: "a@b.c" }))).toEqual({
        status: "locked",
        email: "a@b.c",
      });
      expect(mocks.setCookie).not.toHaveBeenCalled();
    });

    it.each([
      [
        "the admin is not configured",
        () => mocks.config.mockReturnValue({ enabled: false, missing: ["X"] }),
      ],
      [
        "the request comes from another origin",
        () =>
          mocks.context.mockResolvedValue({
            network: "x",
            networkHash: "b".repeat(64),
            userAgent: null,
            isSameOrigin: false,
          }),
      ],
      [
        "the database fails",
        () =>
          mocks.database.mockResolvedValue(
            err({ code: "DB_UNAVAILABLE", message: "down" }),
          ),
      ],
    ])("reads as unavailable when %s", async (_label, arrange) => {
      arrange();

      expect(await signInAction(IDLE, form({ email: "a@b.c" }))).toEqual({
        status: "unavailable",
        email: "a@b.c",
      });
      expect(mocks.signIn).not.toHaveBeenCalled();
    });
  });

  describe("guards", () => {
    it("lets only the second step reach the code check", async () => {
      mocks.verifySecondFactor.mockResolvedValue(ok({ status: "refused" }));

      await secondFactorAction(IDLE, form({}));

      expect(mocks.requireLoginStep).toHaveBeenCalledWith("totp_challenge");
      expect(mocks.requireAdmin).not.toHaveBeenCalled();
    });

    it.each([
      [
        "revokeSessionsAction",
        () => revokeSessionsAction(IDLE, form({ scope: "others" })),
      ],
      ["regenerateCodesAction", () => regenerateCodesAction(IDLE, form({}))],
      ["changePasswordAction", () => changePasswordAction(IDLE, form({}))],
    ])("keeps %s behind a full session", async (_name, run) => {
      mocks.revokeSessions.mockResolvedValue(ok({ status: "refused" }));
      mocks.regenerateRecoveryCodes.mockResolvedValue(
        ok({ status: "refused" }),
      );
      mocks.changePassword.mockResolvedValue(ok({ status: "refused" }));

      await run();

      expect(mocks.requireAdmin).toHaveBeenCalledOnce();
      expect(mocks.requireLoginStep).not.toHaveBeenCalled();
    });
  });

  describe("secondFactorAction", () => {
    it("signs in with a TOTP code or a recovery code", async () => {
      mocks.verifySecondFactor.mockResolvedValue(
        ok({ status: "signed_in", session: STARTED }),
      );

      await expect(
        secondFactorAction(
          IDLE,
          form({ method: "recovery_code", code: "abcde-fghij" }),
        ),
      ).rejects.toThrow("redirect:/admin");
      expect(mocks.verifySecondFactor.mock.calls[0]?.[0]).toEqual({
        kind: "recovery_code",
        code: "abcde-fghij",
      });
      expect(mocks.setCookie).toHaveBeenCalledOnce();
    });

    it("reports a refused code without a new cookie", async () => {
      mocks.verifySecondFactor.mockResolvedValue(ok({ status: "refused" }));

      expect(await secondFactorAction(IDLE, form({ code: "123456" }))).toEqual({
        status: "refused",
      });
      expect(mocks.verifySecondFactor.mock.calls[0]?.[0]).toMatchObject({
        kind: "totp",
      });
    });

    it("reports a database failure as unavailable", async () => {
      mocks.database.mockResolvedValue(
        err({ code: "DB_UNAVAILABLE", message: "down" }),
      );

      expect(await secondFactorAction(IDLE, form({}))).toEqual({
        status: "unavailable",
      });
    });
  });

  describe("signOutAction", () => {
    it("ends the session, clears the cookie and goes to the login", async () => {
      mocks.signOut.mockResolvedValue(ok(undefined));

      await expect(signOutAction()).rejects.toThrow("redirect:/admin/login");
      expect(mocks.signOut).toHaveBeenCalledOnce();
      expect(mocks.clearCookie).toHaveBeenCalledOnce();
    });

    it("still clears the cookie without a session", async () => {
      mocks.session.mockResolvedValue(undefined);

      await expect(signOutAction()).rejects.toThrow("redirect:/admin/login");
      expect(mocks.signOut).not.toHaveBeenCalled();
      expect(mocks.clearCookie).toHaveBeenCalledOnce();
    });
  });

  describe("revokeSessionsAction", () => {
    it("passes the chosen session ids only, with the code and scope", async () => {
      mocks.revokeSessions.mockResolvedValue(
        ok({ status: "done", revoked: 1, signedOut: false }),
      );
      const data = form({ code: "123456", scope: "selected" });
      data.append("sessionId", "b".repeat(64));
      data.append("sessionId", "1 or 1=1");

      expect(await revokeSessionsAction(IDLE, data)).toEqual({
        status: "done",
        revoked: 1,
      });
      expect(mocks.revokeSessions.mock.calls[0]?.[0]).toEqual({
        code: "123456",
        sessionIds: ["b".repeat(64)],
        others: false,
      });
      expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("signs out when the current session was revoked", async () => {
      mocks.revokeSessions.mockResolvedValue(
        ok({ status: "done", revoked: 1, signedOut: true }),
      );

      await expect(
        revokeSessionsAction(IDLE, form({ code: "123456", scope: "others" })),
      ).rejects.toThrow("redirect:/admin/login");
      expect(mocks.revokeSessions.mock.calls[0]?.[0]).toMatchObject({
        others: true,
      });
      expect(mocks.clearCookie).toHaveBeenCalledOnce();
    });

    it("refuses an empty selection before a code is spent", async () => {
      expect(
        await revokeSessionsAction(
          IDLE,
          form({ code: "123456", scope: "selected" }),
        ),
      ).toEqual({ status: "nothing_selected", selected: [] });
      expect(mocks.revokeSessions).not.toHaveBeenCalled();
    });

    it("reports a refused code or an outage, keeping the selection", async () => {
      const chosen = () => {
        const data = form({ scope: "selected" });
        data.append("sessionId", "b".repeat(64));
        return data;
      };
      mocks.revokeSessions.mockResolvedValue(ok({ status: "refused" }));
      expect(await revokeSessionsAction(IDLE, chosen())).toEqual({
        status: "refused",
        selected: ["b".repeat(64)],
      });

      mocks.database.mockResolvedValue(
        err({ code: "DB_UNAVAILABLE", message: "down" }),
      );
      expect(await revokeSessionsAction(IDLE, chosen())).toEqual({
        status: "unavailable",
        selected: ["b".repeat(64)],
      });
    });
  });

  describe("security forms", () => {
    it("issues new recovery codes, and refreshes the count", async () => {
      mocks.regenerateRecoveryCodes.mockResolvedValue(
        ok({ status: "done", recoveryCodes: ["abcde-fghij"] }),
      );

      expect(
        await regenerateCodesAction(
          IDLE,
          form({ currentPassword: "secret", code: "123456" }),
        ),
      ).toEqual({ status: "issued", recoveryCodes: ["abcde-fghij"] });
      expect(mocks.regenerateRecoveryCodes.mock.calls[0]?.[0]).toEqual({
        password: "secret",
        code: "123456",
      });
      expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("reports a refused code for new recovery codes", async () => {
      mocks.regenerateRecoveryCodes.mockResolvedValue(ok({ status: "locked" }));

      expect(await regenerateCodesAction(IDLE, form({}))).toEqual({
        status: "locked",
      });
      mocks.database.mockResolvedValue(
        err({ code: "DB_UNAVAILABLE", message: "down" }),
      );
      expect(await regenerateCodesAction(IDLE, form({}))).toEqual({
        status: "unavailable",
      });
    });

    it("changes the password with every field it needs", async () => {
      mocks.changePassword.mockResolvedValue(
        ok({ status: "done", revoked: 1 }),
      );

      expect(
        await changePasswordAction(
          IDLE,
          form({ currentPassword: "old", newPassword: "new", code: "123456" }),
        ),
      ).toEqual({ status: "done", revoked: 1 });
      expect(mocks.changePassword.mock.calls[0]?.[0]).toEqual({
        currentPassword: "old",
        newPassword: "new",
        code: "123456",
      });
      expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("passes a refused password change on, without refreshing", async () => {
      mocks.changePassword.mockResolvedValue(
        ok({ status: "invalid", problem: "breached" }),
      );

      expect(await changePasswordAction(IDLE, form({}))).toEqual({
        status: "invalid",
        problem: "breached",
      });
      expect(mocks.refresh).not.toHaveBeenCalled();
      mocks.database.mockResolvedValue(
        err({ code: "DB_UNAVAILABLE", message: "down" }),
      );
      expect(await changePasswordAction(IDLE, form({}))).toEqual({
        status: "unavailable",
      });
    });
  });
});
