import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { DEVELOPMENT_SEALING_KEY } from "@/lib/deployment";
import { err, ok } from "@/lib/result";

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  AUTH_SECRETS,
  createAdmin,
} from "../../../test/auth";
import { createTestDatabase, type TestDatabase } from "../../../test/db";
import {
  cliSealingKey,
  createAdminAccount,
  prepareAdminAccount,
  prepareNewPassword,
  prepareSecondFactorReset,
  resetSecondFactor,
  setPassword,
  unlockAll,
} from "./admin-cli";
import { verifyPassword } from "./password";
import { openSecret } from "./secret-box";
import { generateHotp, TOTP_PERIOD_SECONDS } from "./totp";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
});

const NOW = new Date("2026-10-25T12:00:00Z");
const ENROLL = { sealingKey: AUTH_SECRETS.sealingKey, now: NOW };
const notBreached = () => Promise.resolve(ok(false));
const codeFor = (secret: Uint8Array) =>
  generateHotp(secret, Math.floor(NOW.getTime() / 1000 / TOTP_PERIOD_SECONDS));

async function prepared(email = " Admin@Example.com ") {
  const result = await prepareAdminAccount(
    testDb.db,
    { email, password: ADMIN_PASSWORD },
    { isBreached: notBreached },
  );
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
}

describe("cliSealingKey", () => {
  const LOCAL = "postgresql://postgres@localhost:5432/portfolio";
  const REMOTE = "postgresql://user:secret@ep-x.neon.tech/neondb";
  const KEY = Buffer.alloc(32, 7);

  it("falls back to the development key for a local database only", () => {
    expect(cliSealingKey(LOCAL, undefined)).toEqual(
      ok(DEVELOPMENT_SEALING_KEY),
    );
    expect(cliSealingKey(REMOTE, undefined)).toEqual(err("missing"));
  });

  it("refuses the public development key for a remote database", () => {
    expect(
      cliSealingKey(
        REMOTE,
        Buffer.from(DEVELOPMENT_SEALING_KEY).toString("base64"),
      ),
    ).toEqual(err("development_key"));
    expect(cliSealingKey(REMOTE, KEY.toString("base64"))).toEqual(
      ok(new Uint8Array(KEY)),
    );
  });
});

describe("prepareAdminAccount", () => {
  it("draws a secret to show, and stores nothing yet", async () => {
    const account = await prepared();

    expect(account).toMatchObject({
      email: ADMIN_EMAIL,
      breachCheck: "passed",
      enrollment: {
        uri: expect.stringMatching(/^otpauth:\/\/totp\//) as unknown,
      },
    });
    expect(account.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await testDb.query("select id from admin_users")).toEqual([]);
  });

  it.each([
    [{ email: "not an email" }, "invalid_email"],
    [{ password: "too short" }, "too_short"],
    [{ password: `my ${ADMIN_EMAIL} password` }, "contains_context_word"],
  ])("refuses %j as %s", async (overrides, problem) => {
    expect(
      await prepareAdminAccount(
        testDb.db,
        { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, ...overrides },
        { isBreached: notBreached },
      ),
    ).toEqual(err(problem));
  });

  it("refuses a breached password, and goes on if the check is down", async () => {
    expect(
      await prepareAdminAccount(
        testDb.db,
        { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        { isBreached: () => Promise.resolve(ok(true)) },
      ),
    ).toEqual(err("breached"));
    expect(
      await prepareAdminAccount(
        testDb.db,
        { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        { isBreached: () => Promise.resolve(err("unavailable" as const)) },
      ),
    ).toMatchObject({ ok: true, data: { breachCheck: "unavailable" } });
  });

  it("refuses a second admin", async () => {
    await createAdmin(testDb.db);

    expect(
      await prepareAdminAccount(
        testDb.db,
        { email: "other@example.com", password: ADMIN_PASSWORD },
        { isBreached: notBreached },
      ),
    ).toEqual(err("exists"));
  });
});

describe("createAdminAccount", () => {
  it("creates nothing until the authenticator's first code matches", async () => {
    const account = await prepared();

    expect(
      await createAdminAccount(testDb.db, account, "000000", ENROLL),
    ).toEqual(err("code_refused"));
    expect(await testDb.query("select id from admin_users")).toEqual([]);
  });

  it("creates the account with its second factor on, and recovery codes to show once", async () => {
    const account = await prepared();

    const created = await createAdminAccount(
      testDb.db,
      account,
      codeFor(account.secret),
      ENROLL,
    );

    expect(created.ok).toBe(true);
    const { user, recoveryCodes } = created.ok
      ? created.data
      : { user: undefined, recoveryCodes: [] };
    expect(user?.totpEnabledAt).toBeInstanceOf(Date);
    expect(
      openSecret(
        user?.totpSecret ?? "",
        AUTH_SECRETS.sealingKey,
        user?.id ?? "",
      ),
    ).toEqual(ok(account.secret));
    expect(recoveryCodes).toHaveLength(10);
    expect(await testDb.query("select action from audit_logs")).toEqual([
      { action: "auth.totp_enabled" },
    ]);
  });

  it("refuses a second account created at the same time", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const first = await prepared();
    const second = await prepared("other@example.com");
    await createAdminAccount(testDb.db, first, codeFor(first.secret), ENROLL);

    expect(
      await createAdminAccount(
        testDb.db,
        second,
        codeFor(second.secret),
        ENROLL,
      ),
    ).toEqual(err("exists"));
    vi.restoreAllMocks();
  });
});

describe("unlockAll", () => {
  it("clears every lock and count", async () => {
    await testDb.exec(
      `insert into login_throttles (key, scope, failures, locked_until) values ('${"a".repeat(64)}', 'network', 30, now() + interval '1 hour')`,
    );

    expect(await unlockAll(testDb.db)).toEqual(ok(1));
    expect(await testDb.query("select key from login_throttles")).toEqual([]);
  });
});

describe("second factor reset", () => {
  it("knows no unknown email", async () => {
    expect(
      await prepareSecondFactorReset(testDb.db, "nobody@example.com"),
    ).toEqual(ok(undefined));
  });

  it("changes nothing until the new authenticator's first code matches", async () => {
    const admin = await createAdmin(testDb.db);
    const reset = await prepareSecondFactorReset(
      testDb.db,
      "ADMIN@example.com",
    );
    const plan = reset.ok ? reset.data : undefined;
    await testDb.exec(
      `insert into admin_sessions (id, user_id, stage, expires_at) values ('${"d".repeat(64)}', '${admin.id}', 'signed_in', now() + interval '1 hour')`,
    );

    expect(
      plan && (await resetSecondFactor(testDb.db, plan, "000000", ENROLL)),
    ).toEqual(err("code_refused"));
    expect(await testDb.query("select id from admin_sessions")).toHaveLength(1);
  });

  it("ends every session, then replaces the second factor and the recovery codes", async () => {
    const admin = await createAdmin(testDb.db);
    await testDb.exec(
      `insert into recovery_codes (user_id, code_hash) values ('${admin.id}', '${"c".repeat(64)}');
       insert into admin_sessions (id, user_id, stage, expires_at) values ('${"d".repeat(64)}', '${admin.id}', 'signed_in', now() + interval '1 hour')`,
    );
    const reset = await prepareSecondFactorReset(testDb.db, ADMIN_EMAIL);
    const plan = reset.ok ? reset.data : undefined;
    if (plan === undefined) {
      throw new Error("No reset plan");
    }

    const codes = await resetSecondFactor(
      testDb.db,
      plan,
      codeFor(plan.secret),
      ENROLL,
    );

    expect(codes.ok && codes.data).toHaveLength(10);
    expect(await testDb.query("select id from admin_sessions")).toEqual([]);
    const [row] = await testDb.query<{ totp_secret: string }>(
      "select totp_secret from admin_users",
    );
    expect(
      openSecret(row?.totp_secret ?? "", AUTH_SECRETS.sealingKey, admin.id),
    ).toEqual(ok(plan.secret));
    expect(
      await testDb.query(
        `select id from recovery_codes where code_hash = '${"c".repeat(64)}'`,
      ),
    ).toEqual([]);
    expect(await testDb.query("select action from audit_logs")).toEqual([
      { action: "auth.totp_reset" },
    ]);
  });
});

describe("password reset (CLI)", () => {
  const NEW_PASSWORD = "a brand new and long passphrase";

  it.each([
    [{ email: "nobody@example.com" }, "unknown_account"],
    [{ password: "too short" }, "too_short"],
    [{ password: `my ${ADMIN_EMAIL} password` }, "contains_context_word"],
  ])("refuses %j as %s, writing nothing", async (overrides, problem) => {
    await createAdmin(testDb.db);

    expect(
      await prepareNewPassword(
        testDb.db,
        { email: ADMIN_EMAIL, password: NEW_PASSWORD, ...overrides },
        { isBreached: notBreached },
      ),
    ).toEqual(err(problem));
  });

  it("refuses a breached password, and goes on if the check is down", async () => {
    await createAdmin(testDb.db);
    const input = { email: ADMIN_EMAIL, password: NEW_PASSWORD };

    expect(
      await prepareNewPassword(testDb.db, input, {
        isBreached: () => Promise.resolve(ok(true)),
      }),
    ).toEqual(err("breached"));
    expect(
      await prepareNewPassword(testDb.db, input, {
        isBreached: () => Promise.resolve(err("unavailable" as const)),
      }),
    ).toMatchObject({ ok: true, data: { breachCheck: "unavailable" } });
  });

  it("sets the password, ends every session and lifts every lock", async () => {
    const admin = await createAdmin(testDb.db);
    await testDb.exec(
      `insert into admin_sessions (id, user_id, stage, expires_at) values ('${"d".repeat(64)}', '${admin.id}', 'signed_in', now() + interval '1 hour');
       insert into login_throttles (key, scope, failures, locked_until) values ('${"a".repeat(64)}', 'second_factor', 10, now() + interval '1 hour')`,
    );
    const prepared = await prepareNewPassword(
      testDb.db,
      { email: " Admin@Example.com ", password: NEW_PASSWORD },
      { isBreached: notBreached },
    );
    if (!prepared.ok) {
      throw new Error(prepared.error);
    }

    expect(await setPassword(testDb.db, prepared.data)).toEqual(ok(1));
    const [row] = await testDb.query<{ password_hash: string }>(
      "select password_hash from admin_users",
    );
    expect(await verifyPassword(row?.password_hash ?? "", NEW_PASSWORD)).toBe(
      true,
    );
    expect(await testDb.query("select id from admin_sessions")).toEqual([]);
    expect(await testDb.query("select key from login_throttles")).toEqual([]);
    expect(await testDb.query("select action, diff from audit_logs")).toEqual([
      {
        action: "auth.password_changed",
        diff: { revokedCount: 1, method: "cli" },
      },
    ]);
  });
});
