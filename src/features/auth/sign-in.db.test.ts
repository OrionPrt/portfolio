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
  flushDeferred,
  testClock,
  testDependencies,
} from "../../../test/auth";
import { createTestDatabase, type TestDatabase } from "../../../test/db";
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

async function sessionStages() {
  return (
    await testDb.query<{ stage: string }>("select stage from admin_sessions")
  ).map((row) => row.stage);
}

async function auditActions() {
  return (
    await testDb.query<{ action: string }>(
      "select action from audit_logs order by id",
    )
  ).map((row) => row.action);
}

describe("signIn", () => {
  it("asks for the second factor after the right password", async () => {
    await createAdmin(testDb.db);
    const deps = testDependencies(testDb.db, testClock());

    const result = await signIn(
      { email: " Admin@Example.com ", password: ADMIN_PASSWORD },
      CONTEXT,
      deps,
    );

    expect(result).toMatchObject({ ok: true, data: { status: "next" } });
    expect(await sessionStages()).toEqual(["totp_challenge"]);
  });

  it("refuses an account without a second factor: it is set up in the CLI only", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const admin = await createAdmin(testDb.db);
    await testDb.exec(
      `update admin_users set totp_enabled_at = null where id = '${admin.id}'`,
    );
    const deps = testDependencies(testDb.db, testClock());

    expect(
      await signIn(
        { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        CONTEXT,
        deps,
      ),
    ).toEqual({ ok: true, data: { status: "refused" } });
    expect(await sessionStages()).toEqual([]);
  });

  it.each([
    ["a wrong password", ADMIN_EMAIL, "not the right password at all"],
    ["an unknown email", "nobody@example.com", ADMIN_PASSWORD],
  ])(
    "refuses %s the same way, and starts no session",
    async (_label, email, password) => {
      await createAdmin(testDb.db);
      const deps = testDependencies(testDb.db, testClock());

      expect(await signIn({ email, password }, CONTEXT, deps)).toEqual({
        ok: true,
        data: { status: "refused" },
      });
      expect(await sessionStages()).toEqual([]);
    },
  );

  it("audits failures on the real account only", async () => {
    await createAdmin(testDb.db);
    const deps = testDependencies(testDb.db, testClock());

    await signIn(
      { email: ADMIN_EMAIL, password: "wrong password, again" },
      CONTEXT,
      deps,
    );
    await signIn(
      { email: "nobody@example.com", password: "whatever it is" },
      CONTEXT,
      deps,
    );

    await flushDeferred();
    expect(await auditActions()).toEqual(["auth.login_failed"]);
  });

  it("locks the account from this network after 5 failures, and alerts the owner once", async () => {
    await createAdmin(testDb.db);
    const clock = testClock();
    const deps = testDependencies(testDb.db, clock);
    const attempt = () =>
      signIn(
        { email: ADMIN_EMAIL, password: "wrong password, again" },
        CONTEXT,
        deps,
      );

    for (let failure = 1; failure <= 4; failure++) {
      expect(await attempt()).toEqual({
        ok: true,
        data: { status: "refused" },
      });
    }
    expect(await attempt()).toEqual({ ok: true, data: { status: "locked" } });
    // Even the right password waits for the lock to end.
    expect(
      await signIn(
        { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        CONTEXT,
        deps,
      ),
    ).toEqual({ ok: true, data: { status: "locked" } });
    await flushDeferred();
    expect(deps.alertLockout).toHaveBeenCalledOnce();
    expect(await auditActions()).toContain("auth.account_locked");

    clock.advance(60_001);
    expect(
      await signIn(
        { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        CONTEXT,
        deps,
      ),
    ).toMatchObject({ ok: true, data: { status: "next" } });
  });

  it("never locks the account for another network", async () => {
    await createAdmin(testDb.db);
    const deps = testDependencies(testDb.db, testClock());
    for (let failure = 1; failure <= 5; failure++) {
      await signIn(
        { email: ADMIN_EMAIL, password: "wrong password, again" },
        CONTEXT,
        deps,
      );
    }

    expect(
      await signIn(
        { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        { ...CONTEXT, network: "198.51.100.2" },
        deps,
      ),
    ).toMatchObject({ ok: true, data: { status: "next" } });
  });

  it("refuses an oversized password without hashing it", async () => {
    await createAdmin(testDb.db);
    const deps = testDependencies(testDb.db, testClock());

    expect(
      await signIn(
        { email: ADMIN_EMAIL, password: "a".repeat(10_000) },
        CONTEXT,
        deps,
      ),
    ).toEqual({ ok: true, data: { status: "refused" } });
  });
});

describe("signIn — previous session", () => {
  it("ends the session the browser still held (ASVS 7.2.4)", async () => {
    const admin = await createAdmin(testDb.db);
    const deps = testDependencies(testDb.db, testClock());
    await testDb.exec(
      `insert into admin_sessions (id, user_id, stage, expires_at) values ('${"e".repeat(64)}', '${admin.id}', 'signed_in', now() + interval '1 hour')`,
    );

    await signIn(
      {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        previousSessionId: "e".repeat(64),
      },
      CONTEXT,
      deps,
    );

    expect(await sessionStages()).toEqual(["totp_challenge"]);
  });
});

describe("signIn — edge cases", () => {
  it("refuses an oversized email without looking it up", async () => {
    const deps = testDependencies(testDb.db, testClock());

    expect(
      await signIn(
        { email: `${"a".repeat(250)}@example.com`, password: ADMIN_PASSWORD },
        CONTEXT,
        deps,
      ),
    ).toEqual({ ok: true, data: { status: "refused" } });
  });
});
