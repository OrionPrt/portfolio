import { beforeEach, describe, expect, it, vi } from "vitest";

import { err, ok } from "@/lib/result";

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  context: vi.fn(),
  requireAdmin: vi.fn(),
  database: vi.fn(),
  record: vi.fn(),
}));

vi.mock("@/features/auth/config", () => ({ authConfig: mocks.config }));
vi.mock("@/features/auth/request-context", () => ({
  requestContext: mocks.context,
}));
vi.mock("@/features/auth/dal", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db/client", () => ({ withDatabase: mocks.database }));
vi.mock("@/features/auth/audit-repository", () => ({
  createAuditRepository: () => ({ record: mocks.record }),
}));

import { runAdmin } from "./run-admin";

const SESSION = {
  sessionId: "a".repeat(64),
  stage: "signed_in",
  expiresAt: new Date(),
  user: { id: "user-1", email: "admin@example.com" },
};
const CONTEXT = {
  network: "203.0.113.7",
  networkHash: "h".repeat(64),
  userAgent: "Firefox",
  isSameOrigin: true,
};
const DB = { name: "db" };

describe("runAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(SESSION);
    mocks.config.mockReturnValue({ enabled: true, ipHashSalt: "s" });
    mocks.context.mockResolvedValue(CONTEXT);
    mocks.database.mockImplementation((run: (db: unknown) => unknown) =>
      run(DB),
    );
    mocks.record.mockResolvedValue(ok(undefined));
  });

  it("runs the work with the database, and audits as the signed-in admin", async () => {
    const result = await runAdmin(async ({ db, audit }) => {
      await audit({ action: "contact.message_deleted", entityId: "m-1" });
      return ok(db);
    });

    expect(result).toEqual(ok(DB));
    expect(mocks.record).toHaveBeenCalledWith({
      actorId: "user-1",
      action: "contact.message_deleted",
      entityId: "m-1",
      ipHash: CONTEXT.networkHash,
      userAgent: "Firefox",
    });
  });

  it("names the change an audit row is missing for, when it cannot be written", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.record.mockResolvedValue(
      err({ code: "DB_UNAVAILABLE", message: "down" }),
    );

    await runAdmin(async ({ audit }) => {
      await audit({
        action: "content.updated",
        entity: "skill",
        entityId: "s-1",
      });
      return ok(undefined);
    });

    const logged = error.mock.calls.flat().map(String).join("\n");
    expect(logged).toContain("admin.audit_missing");
    expect(logged).toContain("s-1");
    error.mockRestore();
  });

  it("checks the session before anything else (a redirect to the login)", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("redirect:/admin/login"));
    const work = vi.fn();

    await expect(runAdmin(work)).rejects.toThrow("redirect:/admin/login");
    expect(work).not.toHaveBeenCalled();
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it.each([
    [
      "the admin is not configured",
      () => mocks.config.mockReturnValue({ enabled: false, missing: [] }),
    ],
    [
      "the request comes from another origin",
      () =>
        mocks.context.mockResolvedValue({ ...CONTEXT, isSameOrigin: false }),
    ],
    [
      "the database is down",
      () =>
        mocks.database.mockResolvedValue(
          err({ code: "DB_UNAVAILABLE", message: "down" }),
        ),
    ],
  ])("reads as unavailable when %s", async (_case, arrange) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    arrange();
    const work = vi.fn(() => Promise.resolve(ok(1)));

    expect(await runAdmin(work)).toEqual(err("unavailable"));
  });

  it("reads a failed piece of work as unavailable", async () => {
    expect(
      await runAdmin(() =>
        Promise.resolve(err({ code: "DB_UNAVAILABLE", message: "down" })),
      ),
    ).toEqual(err("unavailable"));
  });
});
