import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { err, ok } from "@/lib/result";

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CONTEXT,
  createAdmin,
  testClock,
  testDependencies,
  totpCodeAt,
} from "../../../test/auth";
import { createTestDatabase, type TestDatabase } from "../../../test/db";
import {
  changePassword,
  regenerateRecoveryCodes,
  revokeSessions,
  signOut,
} from "./account-security";
import { verifyPassword } from "./password";
import { startSession } from "./session-service";
import { sessionIdOf } from "./session-token";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

const NEW_PASSWORD = "another long and unique password";

async function signedIn(
  deps: ReturnType<typeof testDependencies>,
  userId: string,
) {
  const started = await startSession(deps.sessions, {
    userId,
    stage: "signed_in",
    now: deps.now(),
    ipHash: null,
    userAgent: null,
  });
  if (!started.ok) {
    throw new Error("No session");
  }
  return {
    sessionId: sessionIdOf(started.data.token),
    userId,
    email: ADMIN_EMAIL,
  };
}

async function sessionCount() {
  return (await testDb.query("select id from admin_sessions")).length;
}

describe("regenerateRecoveryCodes", () => {
  it("needs the password and a current TOTP code (ASVS 7.5.1), then replaces every code", async () => {
    const admin = await createAdmin(testDb.db);
    const clock = testClock();
    const deps = testDependencies(testDb.db, clock);
    const current = await signedIn(deps, admin.id);

    expect(
      await regenerateRecoveryCodes(
        { password: "not the password at all", code: totpCodeAt(clock.now()) },
        current,
        CONTEXT,
        deps,
      ),
    ).toEqual(ok({ status: "refused" }));
    expect(
      await regenerateRecoveryCodes(
        { password: ADMIN_PASSWORD, code: "000000" },
        current,
        CONTEXT,
        deps,
      ),
    ).toEqual(ok({ status: "refused" }));
    const result = await regenerateRecoveryCodes(
      { password: ADMIN_PASSWORD, code: totpCodeAt(clock.now()) },
      current,
      CONTEXT,
      deps,
    );

    expect(result).toMatchObject({ ok: true, data: { status: "done" } });
    expect(await deps.recoveryCodes.countUnused(admin.id)).toEqual(ok(10));
  });
});

describe("reauthentication", () => {
  it("counts a wrong current password against the account, never against the TOTP step", async () => {
    const admin = await createAdmin(testDb.db);
    const clock = testClock();
    const deps = testDependencies(testDb.db, clock);
    const current = await signedIn(deps, admin.id);
    // A stolen session, guessing the password from many networks.
    for (let guess = 1; guess <= 12; guess++) {
      const context = { ...CONTEXT, network: `198.51.100.${String(guess)}` };
      await regenerateRecoveryCodes(
        { password: "not the password at all", code: "000000" },
        current,
        context,
        deps,
      );
    }

    // The owner, from their own network: the TOTP step is not locked.
    expect(
      await regenerateRecoveryCodes(
        { password: ADMIN_PASSWORD, code: totpCodeAt(clock.now()) },
        current,
        CONTEXT,
        deps,
      ),
    ).toMatchObject({ ok: true, data: { status: "done" } });
  });
});

describe("changePassword", () => {
  it("needs the current password and a TOTP code, then signs out every other session", async () => {
    const admin = await createAdmin(testDb.db);
    const clock = testClock();
    const deps = testDependencies(testDb.db, clock);
    const current = await signedIn(deps, admin.id);
    await signedIn(deps, admin.id);

    const result = await changePassword(
      {
        currentPassword: ADMIN_PASSWORD,
        newPassword: NEW_PASSWORD,
        code: totpCodeAt(clock.now()),
      },
      current,
      CONTEXT,
      deps,
    );

    expect(result).toEqual(ok({ status: "done", revoked: 1 }));
    expect(await sessionCount()).toBe(1);
    const user = await deps.users.findById(admin.id);
    expect(
      user.ok &&
        (await verifyPassword(user.data?.passwordHash ?? "", NEW_PASSWORD)),
    ).toBe(true);
  });

  it.each([
    [
      "a wrong current password",
      { currentPassword: "not the password at all" },
      { status: "refused" },
    ],
    ["a wrong code", { code: "000000" }, { status: "refused" }],
    [
      "a short new password",
      { newPassword: "too short" },
      { status: "invalid", problem: "too_short" },
    ],
  ])("refuses %s", async (_label, overrides, outcome) => {
    const admin = await createAdmin(testDb.db);
    const clock = testClock();
    const deps = testDependencies(testDb.db, clock);

    expect(
      await changePassword(
        {
          currentPassword: ADMIN_PASSWORD,
          newPassword: NEW_PASSWORD,
          code: totpCodeAt(clock.now()),
          ...overrides,
        },
        await signedIn(deps, admin.id),
        CONTEXT,
        deps,
      ),
    ).toEqual(ok(outcome));
  });

  it("checks the new password before spending the TOTP code, good once", async () => {
    const admin = await createAdmin(testDb.db);
    const clock = testClock();
    const deps = testDependencies(testDb.db, clock);
    const current = await signedIn(deps, admin.id);
    const code = totpCodeAt(clock.now());

    expect(
      await changePassword(
        { currentPassword: ADMIN_PASSWORD, newPassword: "too short", code },
        current,
        CONTEXT,
        deps,
      ),
    ).toEqual(ok({ status: "invalid", problem: "too_short" }));
    expect(
      await changePassword(
        { currentPassword: ADMIN_PASSWORD, newPassword: NEW_PASSWORD, code },
        current,
        CONTEXT,
        deps,
      ),
    ).toMatchObject({ ok: true, data: { status: "done" } });
  });

  it("refuses a password found in breaches, and lets one through if the check is down", async () => {
    const admin = await createAdmin(testDb.db);
    const clock = testClock();
    const breached = testDependencies(testDb.db, clock, {
      isBreached: () => Promise.resolve(ok(true)),
    });

    expect(
      await changePassword(
        {
          currentPassword: ADMIN_PASSWORD,
          newPassword: NEW_PASSWORD,
          code: totpCodeAt(clock.now()),
        },
        await signedIn(breached, admin.id),
        CONTEXT,
        breached,
      ),
    ).toEqual(ok({ status: "invalid", problem: "breached" }));

    clock.advance(30_000);
    const unavailable = testDependencies(testDb.db, clock, {
      isBreached: () => Promise.resolve(err("unavailable" as const)),
    });
    expect(
      await changePassword(
        {
          currentPassword: ADMIN_PASSWORD,
          newPassword: NEW_PASSWORD,
          code: totpCodeAt(clock.now()),
        },
        await signedIn(unavailable, admin.id),
        CONTEXT,
        unavailable,
      ),
    ).toMatchObject({ ok: true, data: { status: "done" } });
  });
});

describe("revokeSessions and signOut", () => {
  it("needs a TOTP code (ASVS 7.5.2), then revokes the account's chosen sessions only", async () => {
    const admin = await createAdmin(testDb.db);
    const clock = testClock();
    const deps = testDependencies(testDb.db, clock);
    const current = await signedIn(deps, admin.id);
    const other = await signedIn(deps, admin.id);

    expect(
      await revokeSessions(
        { code: "000000", sessionIds: [other.sessionId], others: false },
        current,
        CONTEXT,
        deps,
      ),
    ).toEqual(ok({ status: "refused" }));
    expect(
      await revokeSessions(
        {
          code: totpCodeAt(clock.now()),
          sessionIds: [other.sessionId, "f".repeat(64)],
          others: false,
        },
        current,
        CONTEXT,
        deps,
      ),
    ).toEqual(ok({ status: "done", revoked: 1, signedOut: false }));
    expect(await sessionCount()).toBe(1);
  });

  it("revokes every other session at once (ASVS 7.4.3), or signs out the current one", async () => {
    const admin = await createAdmin(testDb.db);
    const clock = testClock();
    const deps = testDependencies(testDb.db, clock);
    const current = await signedIn(deps, admin.id);
    await signedIn(deps, admin.id);
    await signedIn(deps, admin.id);

    expect(
      await revokeSessions(
        { code: totpCodeAt(clock.now()), sessionIds: [], others: true },
        current,
        CONTEXT,
        deps,
      ),
    ).toEqual(ok({ status: "done", revoked: 2, signedOut: false }));
    clock.advance(30_000);
    expect(
      await revokeSessions(
        {
          code: totpCodeAt(clock.now()),
          sessionIds: [current.sessionId],
          others: false,
        },
        current,
        CONTEXT,
        deps,
      ),
    ).toEqual(ok({ status: "done", revoked: 1, signedOut: true }));
    expect(await sessionCount()).toBe(0);
  });

  it("signs out of the current session, audited", async () => {
    const admin = await createAdmin(testDb.db);
    const deps = testDependencies(testDb.db, testClock());
    const current = await signedIn(deps, admin.id);

    await signOut(current, CONTEXT, deps);

    expect(await sessionCount()).toBe(0);
    const actions = await testDb.query<{ action: string }>(
      "select action from audit_logs",
    );
    expect(actions).toEqual([{ action: "auth.signed_out" }]);
  });
});
