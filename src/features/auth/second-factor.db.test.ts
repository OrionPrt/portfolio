import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

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
import { hashRecoveryCode } from "./recovery-codes";
import { verifySecondFactor } from "./second-factor";
import { sessionIdOf } from "./session-token";
import { signIn } from "./sign-in";

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
});

/** Signs in with the password: the partial session the second factor completes. */
async function partialSession(
  deps: ReturnType<typeof testDependencies>,
  context = CONTEXT,
) {
  const result = await signIn(
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    context,
    deps,
  );
  if (!result.ok || result.data.status !== "next") {
    throw new Error("No partial session");
  }
  const users = await deps.users.findByEmail(ADMIN_EMAIL);
  if (!users.ok || users.data === undefined) {
    throw new Error("No admin");
  }
  return {
    sessionId: sessionIdOf(result.data.session.token),
    userId: users.data.id,
  };
}

async function sessions() {
  return testDb.query<{ id: string; stage: string }>(
    "select id, stage from admin_sessions",
  );
}

describe("verifySecondFactor", () => {
  it("signs in with a TOTP code, in a new session that replaces the partial one", async () => {
    await createAdmin(testDb.db);
    const clock = testClock();
    const deps = testDependencies(testDb.db, clock);
    const current = await partialSession(deps);

    const result = await verifySecondFactor(
      { kind: "totp", code: totpCodeAt(clock.now()) },
      current,
      CONTEXT,
      deps,
    );

    expect(result).toMatchObject({ ok: true, data: { status: "signed_in" } });
    const rows = await sessions();
    expect(rows.map((row) => row.stage)).toEqual(["signed_in"]);
    expect(rows[0]?.id).not.toBe(current.sessionId);
  });

  it("accepts a code pasted with the space apps show", async () => {
    await createAdmin(testDb.db);
    const clock = testClock();
    const deps = testDependencies(testDb.db, clock);
    const code = totpCodeAt(clock.now());

    expect(
      await verifySecondFactor(
        { kind: "totp", code: ` ${code.slice(0, 3)} ${code.slice(3)} ` },
        await partialSession(deps),
        CONTEXT,
        deps,
      ),
    ).toMatchObject({ ok: true, data: { status: "signed_in" } });
  });

  it("refuses a code already used, even within its time step (replay)", async () => {
    await createAdmin(testDb.db);
    const clock = testClock();
    const deps = testDependencies(testDb.db, clock);
    const code = totpCodeAt(clock.now());
    await verifySecondFactor(
      { kind: "totp", code },
      await partialSession(deps),
      CONTEXT,
      deps,
    );

    expect(
      await verifySecondFactor(
        { kind: "totp", code },
        await partialSession(deps),
        CONTEXT,
        deps,
      ),
    ).toEqual({ ok: true, data: { status: "refused" } });
  });

  it("accepts a recovery code once, and audits its use", async () => {
    const admin = await createAdmin(testDb.db);
    const deps = testDependencies(testDb.db, testClock());
    await deps.recoveryCodes.replace(admin.id, [
      hashRecoveryCode("abcdefghijklmnopqrstuvwx"),
    ]);

    expect(
      await verifySecondFactor(
        { kind: "recovery_code", code: "ABCD-EFGH-IJKL-MNOP-QRST-UVWX" },
        await partialSession(deps),
        CONTEXT,
        deps,
      ),
    ).toMatchObject({ ok: true, data: { status: "signed_in" } });
    expect(
      await verifySecondFactor(
        { kind: "recovery_code", code: "abcd-efgh-ijkl-mnop-qrst-uvwx" },
        await partialSession(deps),
        CONTEXT,
        deps,
      ),
    ).toEqual({ ok: true, data: { status: "refused" } });
    const actions = await testDb.query<{ action: string }>(
      "select action from audit_logs",
    );
    expect(actions.map((row) => row.action)).toContain(
      "auth.recovery_code_used",
    );
  });

  it("ends the partial session once failures lock the account", async () => {
    await createAdmin(testDb.db);
    const deps = testDependencies(testDb.db, testClock());
    const current = await partialSession(deps);

    let status = "";
    for (let failure = 1; failure <= 5; failure++) {
      const result = await verifySecondFactor(
        { kind: "totp", code: "000000" },
        current,
        CONTEXT,
        deps,
      );
      status = result.ok ? result.data.status : "error";
    }

    expect(status).toBe("locked");
    expect(await sessions()).toEqual([]);
  });
});

describe("verifySecondFactor — edge cases", () => {
  it("locks the TOTP step from every network after 10 wrong codes, recovery codes aside", async () => {
    const admin = await createAdmin(testDb.db);
    const clock = testClock();
    const deps = testDependencies(testDb.db, clock);
    await deps.recoveryCodes.replace(admin.id, [
      hashRecoveryCode("abcdefghijklmnopqrstuvwx"),
    ]);
    // 4 wrong codes from each of 3 networks: under each network's own limit.
    for (const network of ["198.51.100.1", "198.51.100.2", "198.51.100.3"]) {
      const context = { ...CONTEXT, network };
      for (let failure = 1; failure <= 4; failure++) {
        await verifySecondFactor(
          { kind: "totp", code: "000000" },
          await partialSession(deps, context),
          context,
          deps,
        );
      }
    }

    // A fresh network, the right code: still locked.
    const fresh = { ...CONTEXT, network: "192.0.2.9" };
    expect(
      await verifySecondFactor(
        { kind: "totp", code: totpCodeAt(clock.now()) },
        await partialSession(deps, fresh),
        fresh,
        deps,
      ),
    ).toEqual({ ok: true, data: { status: "locked" } });
    // The owner still gets in with a recovery code.
    expect(
      await verifySecondFactor(
        { kind: "recovery_code", code: "abcd-efgh-ijkl-mnop-qrst-uvwx" },
        await partialSession(deps, fresh),
        fresh,
        deps,
      ),
    ).toMatchObject({ ok: true, data: { status: "signed_in" } });
  });

  it("lets the owner in once a lock is over, past the threshold (review finding)", async () => {
    await createAdmin(testDb.db);
    const clock = testClock();
    const deps = testDependencies(testDb.db, clock);
    for (let failure = 1; failure <= 5; failure++) {
      await signIn(
        { email: ADMIN_EMAIL, password: "not the password at all" },
        CONTEXT,
        deps,
      );
    }
    clock.advance(61_000);

    // The sixth count is the right password: its own lock goes with its refund.
    const current = await partialSession(deps);
    expect(
      await verifySecondFactor(
        { kind: "totp", code: totpCodeAt(clock.now()) },
        current,
        CONTEXT,
        deps,
      ),
    ).toMatchObject({ ok: true, data: { status: "signed_in" } });
  });

  it("completes a partial session once, even when two requests race", async () => {
    await createAdmin(testDb.db);
    const clock = testClock();
    const deps = testDependencies(testDb.db, clock);
    const current = await partialSession(deps);

    const racing = await Promise.all([
      verifySecondFactor(
        { kind: "totp", code: totpCodeAt(clock.now()) },
        current,
        CONTEXT,
        deps,
      ),
      verifySecondFactor(
        {
          kind: "totp",
          code: totpCodeAt(new Date(clock.now().getTime() + 30_000)),
        },
        current,
        CONTEXT,
        deps,
      ),
    ]);

    const signedIn = racing.filter(
      (result) => result.ok && result.data.status === "signed_in",
    );
    expect(signedIn).toHaveLength(1);
  });

  it("refuses a session whose account is gone, or has no second factor", async () => {
    const deps = testDependencies(testDb.db, testClock());
    const admin = await createAdmin(testDb.db);
    await testDb.exec(
      `update admin_users set totp_secret = null, totp_enabled_at = null where id = '${admin.id}'`,
    );

    expect(
      await verifySecondFactor(
        { kind: "totp", code: "123456" },
        { sessionId: "a".repeat(64), userId: admin.id },
        CONTEXT,
        deps,
      ),
    ).toEqual({ ok: true, data: { status: "refused" } });
    expect(
      await verifySecondFactor(
        { kind: "totp", code: "123456" },
        {
          sessionId: "a".repeat(64),
          userId: "00000000-0000-4000-8000-000000000000",
        },
        CONTEXT,
        deps,
      ),
    ).toEqual({ ok: true, data: { status: "refused" } });
  });

  it("checks nothing while the account is locked, and ends the partial session", async () => {
    await createAdmin(testDb.db);
    const clock = testClock();
    const deps = testDependencies(testDb.db, clock);
    const current = await partialSession(deps);
    for (let failure = 1; failure <= 5; failure++) {
      await signIn(
        { email: ADMIN_EMAIL, password: "wrong password, again" },
        CONTEXT,
        deps,
      );
    }

    expect(
      await verifySecondFactor(
        { kind: "totp", code: totpCodeAt(clock.now()) },
        current,
        CONTEXT,
        deps,
      ),
    ).toEqual({ ok: true, data: { status: "locked" } });
    expect(await sessions()).toEqual([]);
  });

  it("refuses a malformed recovery code without looking it up", async () => {
    await createAdmin(testDb.db);
    const deps = testDependencies(testDb.db, testClock());

    expect(
      await verifySecondFactor(
        { kind: "recovery_code", code: "not a code" },
        await partialSession(deps),
        CONTEXT,
        deps,
      ),
    ).toEqual({ ok: true, data: { status: "refused" } });
  });
});
