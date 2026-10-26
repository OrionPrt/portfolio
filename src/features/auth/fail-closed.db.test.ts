import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { err } from "@/lib/result";

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
} from "./account-security";
import type { AuthDependencies } from "./auth-dependencies";
import { verifySecondFactor } from "./second-factor";
import { signIn } from "./sign-in";
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
});

const DOWN = err({ code: "DB_UNAVAILABLE", message: "down" });
const failing = () => Promise.resolve(DOWN);

/** The real dependencies, with one repository method failing like an outage. */
function withFailure(
  deps: AuthDependencies,
  repository: "users" | "sessions" | "throttles" | "recoveryCodes",
  method: string,
): AuthDependencies {
  return { ...deps, [repository]: { ...deps[repository], [method]: failing } };
}

/** A real partial session, made with working dependencies. */
async function partialSession(userId: string, clock: { now: () => Date }) {
  const signedIn = await signIn(
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    CONTEXT,
    testDependencies(testDb.db, clock),
  );
  if (!signedIn.ok || signedIn.data.status !== "next") {
    throw new Error("No partial session");
  }
  return { sessionId: sessionIdOf(signedIn.data.session.token), userId };
}

const current = (userId: string) => ({
  sessionId: "a".repeat(64),
  userId,
  email: ADMIN_EMAIL,
});

describe("every flow fails closed on a database failure", () => {
  it.each([
    ["throttles", "lockedUntil"],
    ["throttles", "reserve"],
    ["users", "findByEmail"],
    ["sessions", "create"],
  ] as const)("signIn when %s.%s fails", async (repository, method) => {
    await createAdmin(testDb.db);
    const deps = withFailure(
      testDependencies(testDb.db, testClock()),
      repository,
      method,
    );

    expect(
      await signIn(
        { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        CONTEXT,
        deps,
      ),
    ).toEqual(DOWN);
  });

  it.each([
    ["users", "findById"],
    ["throttles", "lockedUntil"],
    ["throttles", "reserve"],
    ["users", "acceptTotpStep"],
    ["sessions", "consumeAtStage"],
    ["sessions", "create"],
  ] as const)(
    "verifySecondFactor when %s.%s fails",
    async (repository, method) => {
      const admin = await createAdmin(testDb.db);
      const clock = testClock();
      const partial = await partialSession(admin.id, clock);
      const deps = withFailure(
        testDependencies(testDb.db, clock),
        repository,
        method,
      );

      expect(
        await verifySecondFactor(
          { kind: "totp", code: totpCodeAt(clock.now()) },
          partial,
          CONTEXT,
          deps,
        ),
      ).toEqual(DOWN);
    },
  );

  it.each([
    ["users", "findById"],
    ["throttles", "lockedUntil"],
    ["throttles", "reserve"],
    // The password's reservation given back: no code is checked without it.
    ["throttles", "refund"],
    ["users", "acceptTotpStep"],
    ["recoveryCodes", "replace"],
  ] as const)(
    "regenerateRecoveryCodes when %s.%s fails",
    async (repository, method) => {
      const admin = await createAdmin(testDb.db);
      const clock = testClock();
      const deps = withFailure(
        testDependencies(testDb.db, clock),
        repository,
        method,
      );

      expect(
        await regenerateRecoveryCodes(
          { password: ADMIN_PASSWORD, code: totpCodeAt(clock.now()) },
          current(admin.id),
          CONTEXT,
          deps,
        ),
      ).toEqual(DOWN);
    },
  );

  it.each([
    ["users", "updatePassword"],
    ["sessions", "deleteForUser"],
  ] as const)("changePassword when %s.%s fails", async (repository, method) => {
    const admin = await createAdmin(testDb.db);
    const clock = testClock();
    const deps = withFailure(
      testDependencies(testDb.db, clock),
      repository,
      method,
    );

    expect(
      await changePassword(
        {
          currentPassword: ADMIN_PASSWORD,
          newPassword: "another long and unique password",
          code: totpCodeAt(clock.now()),
        },
        current(admin.id),
        CONTEXT,
        deps,
      ),
    ).toEqual(DOWN);
  });

  it.each([
    ["users", "findById", "selected"],
    ["sessions", "deleteOwned", "selected"],
    ["sessions", "deleteForUser", "others"],
  ] as const)(
    "revokeSessions when %s.%s fails (%s)",
    async (repository, method, scope) => {
      const admin = await createAdmin(testDb.db);
      const clock = testClock();
      const deps = withFailure(
        testDependencies(testDb.db, clock),
        repository,
        method,
      );

      expect(
        await revokeSessions(
          {
            code: totpCodeAt(clock.now()),
            sessionIds: ["b".repeat(64)],
            others: scope === "others",
          },
          current(admin.id),
          CONTEXT,
          deps,
        ),
      ).toEqual(DOWN);
    },
  );
});
