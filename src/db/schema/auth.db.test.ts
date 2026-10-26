import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import {
  adminSessions,
  adminUsers,
  auditLogs,
  loginThrottles,
  recoveryCodes,
} from "./index";

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

const HASH = "a".repeat(64);
const SEALED = "v1.aXY.Y2lwaGVy.dGFn";
const USER = {
  email: "admin@example.com",
  passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA",
};

async function newUser(
  overrides: Partial<typeof adminUsers.$inferInsert> = {},
) {
  const [user] = await testDb.db
    .insert(adminUsers)
    .values({ ...USER, ...overrides })
    .returning();
  if (user === undefined) {
    throw new Error("No user inserted");
  }
  return user;
}

/** Fails unless the write is refused by this very constraint, not by any other error. */
async function expectRefusedBy(write: Promise<unknown>, constraint: string) {
  await expect(write).rejects.toMatchObject({ cause: { constraint } });
}

describe("admin_users", () => {
  it("stores an account with no second factor yet", async () => {
    expect(await newUser()).toMatchObject({
      ...USER,
      totpSecret: null,
      totpEnabledAt: null,
      totpLastStep: null,
    });
  });

  it.each([
    ["email", "Admin@Example.com", "admin_users_email_format"],
    ["email", "admin", "admin_users_email_format"],
    ["email", `${"a".repeat(250)}@example.com`, "admin_users_email_format"],
    // Only an argon2id hash, never a password or another algorithm's hash.
    ["passwordHash", "hunter2", "admin_users_password_hash_format"],
    ["passwordHash", "$2b$12$abc", "admin_users_password_hash_format"],
    // Only a sealed secret, never the base32 secret itself.
    ["totpSecret", "JBSWY3DPEHPK3PXP", "admin_users_totp_secret_format"],
    ["totpLastStep", -1, "admin_users_totp_last_step_positive"],
  ])("refuses a %s of %j", async (field, value, constraint) => {
    await expectRefusedBy(newUser({ [field]: value }), constraint);
  });

  it("refuses a second factor marked enabled without a secret", async () => {
    await expectRefusedBy(
      newUser({ totpEnabledAt: new Date() }),
      "admin_users_totp_enabled_with_secret",
    );
  });

  it("refuses a second account, whatever its email", async () => {
    await newUser({ totpSecret: SEALED });

    await expectRefusedBy(
      newUser({ email: "other@example.com" }),
      "admin_users_single_row",
    );
  });
});

describe("admin_sessions", () => {
  const inAnHour = () => new Date(Date.now() + 3_600_000);

  it("is removed with its account", async () => {
    const user = await newUser();
    await testDb.db.insert(adminSessions).values({
      id: HASH,
      userId: user.id,
      stage: "signed_in",
      expiresAt: inAnHour(),
    });

    await testDb.db.delete(adminUsers).where(eq(adminUsers.id, user.id));

    expect(await testDb.db.select().from(adminSessions)).toEqual([]);
  });

  it.each([
    // Only the token's hash is stored, never the token.
    [{ id: "token" }, "admin_sessions_id_format"],
    [{ expiresAt: new Date(0) }, "admin_sessions_expiry_after_creation"],
    [{ ipHash: "203.0.113.7" }, "admin_sessions_ip_hash_format"],
    [{ userAgent: "a".repeat(513) }, "admin_sessions_user_agent_length"],
  ])("refuses %j", async (overrides, constraint) => {
    const user = await newUser();

    await expectRefusedBy(
      testDb.db.insert(adminSessions).values({
        id: HASH,
        userId: user.id,
        stage: "signed_in",
        expiresAt: inAnHour(),
        ...overrides,
      }),
      constraint,
    );
  });
});

describe("recovery_codes", () => {
  it("refuses a code stored in clear, or twice for one account", async () => {
    const user = await newUser();
    await testDb.db
      .insert(recoveryCodes)
      .values({ userId: user.id, codeHash: HASH });

    await expectRefusedBy(
      testDb.db
        .insert(recoveryCodes)
        .values({ userId: user.id, codeHash: "abcde-fghij" }),
      "recovery_codes_hash_format",
    );
    await expectRefusedBy(
      testDb.db
        .insert(recoveryCodes)
        .values({ userId: user.id, codeHash: HASH }),
      "recovery_codes_user_code_key",
    );
  });
});

describe("login_throttles", () => {
  it.each([
    [
      { scope: "network" as const, key: "203.0.113.7" },
      "login_throttles_key_format",
    ],
    [
      { scope: "network" as const, failures: -1 },
      "login_throttles_failures_positive",
    ],
  ])("refuses %j", async (overrides, constraint) => {
    await expectRefusedBy(
      testDb.db.insert(loginThrottles).values({ key: HASH, ...overrides }),
      constraint,
    );
  });
});

describe("audit_logs", () => {
  it("keeps an event when its actor is deleted", async () => {
    const user = await newUser();
    await testDb.db
      .insert(auditLogs)
      .values({ actorId: user.id, action: "auth.login_succeeded" });

    await testDb.db.delete(adminUsers).where(eq(adminUsers.id, user.id));

    expect(await testDb.db.select().from(auditLogs)).toMatchObject([
      { actorId: null, action: "auth.login_succeeded" },
    ]);
  });

  it.each([
    [{ action: "Login" }, "audit_logs_action_format"],
    [{ action: "auth.login; drop" }, "audit_logs_action_format"],
    [
      { action: "auth.login", ipHash: "203.0.113.7" },
      "audit_logs_ip_hash_format",
    ],
  ])("refuses %j", async (values, constraint) => {
    await expectRefusedBy(
      testDb.db.insert(auditLogs).values(values),
      constraint,
    );
  });
});
