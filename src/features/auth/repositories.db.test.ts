import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { THROTTLE_POLICY } from "./throttle-policy";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createAuditRepository } from "./audit-repository";
import { createRecoveryCodesRepository } from "./recovery-codes-repository";
import { createSessionsRepository } from "./sessions-repository";
import { createThrottleRepository } from "./throttle-repository";
import {
  createUsersRepository,
  type AdminUserRecord,
} from "./users-repository";

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

const HASH = "$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA";
const SEALED = "v1.aXY.Y2lwaGVy.dGFn";
const hex = (character: string) => character.repeat(64);

function unwrap<T>(result: { ok: true; data: T } | { ok: false }): T {
  if (!result.ok) {
    throw new Error("Unexpected failure");
  }
  return result.data;
}

const ADMIN_ID = "6f1c4c1e-3c6a-4f0e-9d0b-1f6c2b9a7e10";

async function newAdmin(): Promise<AdminUserRecord> {
  return unwrap(
    await createUsersRepository(testDb.db).createEnrolled({
      id: ADMIN_ID,
      email: " Admin@Example.com ",
      passwordHash: HASH,
      totpSecret: SEALED,
      totpLastStep: 100,
    }),
  );
}

describe("users repository", () => {
  it("creates the admin with its second factor on, and finds it", async () => {
    const users = createUsersRepository(testDb.db);
    const admin = await newAdmin();

    expect(admin).toMatchObject({
      id: ADMIN_ID,
      email: "admin@example.com",
      totpSecret: SEALED,
      totpLastStep: 100,
      totpEnabledAt: expect.any(Date) as unknown,
    });
    expect(unwrap(await users.findByEmail("ADMIN@example.com"))?.id).toBe(
      ADMIN_ID,
    );
    expect(unwrap(await users.findById(ADMIN_ID))?.email).toBe(
      "admin@example.com",
    );
    expect(
      unwrap(await users.findByEmail("other@example.com")),
    ).toBeUndefined();
    expect(unwrap(await users.count())).toBe(1);
  });

  it("holds one account only, whatever the email", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await newAdmin();

    const second = await createUsersRepository(testDb.db).createEnrolled({
      id: "00000000-0000-4000-8000-000000000000",
      email: "other@example.com",
      passwordHash: HASH,
      totpSecret: SEALED,
      totpLastStep: 0,
    });

    expect(second.ok).toBe(false);
    vi.restoreAllMocks();
  });

  it("accepts each TOTP step once, and never an older one (replay)", async () => {
    const users = createUsersRepository(testDb.db);
    await newAdmin();

    expect(unwrap(await users.acceptTotpStep(ADMIN_ID, 100))).toBe(false);
    expect(unwrap(await users.acceptTotpStep(ADMIN_ID, 99))).toBe(false);
    const racing = await Promise.all([
      users.acceptTotpStep(ADMIN_ID, 101),
      users.acceptTotpStep(ADMIN_ID, 101),
    ]);
    expect(racing.map(unwrap).sort()).toEqual([false, true]);
  });

  it("changes the password, and replaces the second factor (CLI)", async () => {
    const users = createUsersRepository(testDb.db);
    const admin = await newAdmin();
    // Shaped like a sealed secret, but nothing is sealed: the repository stores text.
    const replacement = "v1.fake-nonce.fake-ciphertext.fake-tag";

    unwrap(await users.updatePassword(ADMIN_ID, `${HASH}x`));
    unwrap(await users.replaceTotp(ADMIN_ID, replacement, 5));

    const updated = unwrap(await users.findById(ADMIN_ID));
    expect(updated).toMatchObject({
      passwordHash: `${HASH}x`,
      totpSecret: replacement,
      totpLastStep: 5,
    });
    expect(updated?.passwordChangedAt.getTime()).toBeGreaterThanOrEqual(
      admin.passwordChangedAt.getTime(),
    );
  });
});

describe("sessions repository", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  const inMinutes = (count: number) => new Date(now.getTime() + count * 60_000);

  async function newSession(
    id: string,
    stage: "signed_in" | "totp_challenge" = "signed_in",
    expiresAt = inMinutes(60),
  ) {
    unwrap(
      await createSessionsRepository(testDb.db).create({
        id: hex(id),
        userId: ADMIN_ID,
        stage,
        createdAt: now,
        expiresAt,
        ipHash: null,
        userAgent: "Mozilla/5.0",
      }),
    );
  }

  it("finds a session with its account, touches and deletes it", async () => {
    const sessions = createSessionsRepository(testDb.db);
    await newAdmin();
    await newSession("a");

    expect(unwrap(await sessions.findWithUser(hex("a")))).toMatchObject({
      session: { id: hex("a"), stage: "signed_in", userAgent: "Mozilla/5.0" },
      user: { id: ADMIN_ID },
    });
    unwrap(await sessions.touch(hex("a"), inMinutes(5)));
    expect(
      unwrap(await sessions.findWithUser(hex("a")))?.session.lastSeenAt,
    ).toEqual(inMinutes(5));
    unwrap(await sessions.delete(hex("a")));
    expect(unwrap(await sessions.findWithUser(hex("a")))).toBeUndefined();
  });

  it("uses up a partial session once, only at its stage and while live", async () => {
    const sessions = createSessionsRepository(testDb.db);
    await newAdmin();
    await newSession("a", "totp_challenge");
    await newSession("b", "signed_in");

    expect(
      unwrap(
        await sessions.consumeAtStage(
          hex("b"),
          ADMIN_ID,
          "totp_challenge",
          now,
        ),
      ),
    ).toBe(false);
    expect(
      unwrap(
        await sessions.consumeAtStage(
          hex("a"),
          ADMIN_ID,
          "totp_challenge",
          inMinutes(61),
        ),
      ),
    ).toBe(false);
    const racing = await Promise.all([
      sessions.consumeAtStage(hex("a"), ADMIN_ID, "totp_challenge", now),
      sessions.consumeAtStage(hex("a"), ADMIN_ID, "totp_challenge", now),
    ]);
    expect(racing.map(unwrap).sort()).toEqual([false, true]);
  });

  it("lists the live signed-in sessions only, and revokes in one statement", async () => {
    const sessions = createSessionsRepository(testDb.db);
    await newAdmin();
    for (const id of ["a", "b", "c"]) {
      await newSession(id);
    }
    await newSession("d", "totp_challenge");
    await newSession("e", "signed_in", inMinutes(1));

    expect(
      unwrap(await sessions.listForUser(ADMIN_ID, inMinutes(2))).map(
        (session) => session.id,
      ),
    ).toHaveLength(3);
    expect(
      unwrap(await sessions.deleteOwned([hex("b"), hex("f")], ADMIN_ID)),
    ).toBe(1);
    expect(
      unwrap(
        await sessions.deleteOwned(
          [hex("c")],
          "00000000-0000-4000-8000-000000000000",
        ),
      ),
    ).toBe(0);
    expect(unwrap(await sessions.deleteOwned([], ADMIN_ID))).toBe(0);
    expect(unwrap(await sessions.deleteForUser(ADMIN_ID, hex("a")))).toBe(3);
  });

  it("purges expired sessions", async () => {
    const sessions = createSessionsRepository(testDb.db);
    await newAdmin();
    await newSession("a", "signed_in", inMinutes(1));

    expect(unwrap(await sessions.deleteExpired(inMinutes(2)))).toBe(1);
  });
});

describe("recovery codes repository", () => {
  it("replaces the codes, then consumes each one once", async () => {
    const codes = createRecoveryCodesRepository(testDb.db);
    const admin = await newAdmin();
    unwrap(await codes.replace(admin.id, [hex("a"), hex("b")]));
    unwrap(await codes.replace(admin.id, [hex("c"), hex("d")]));

    expect(unwrap(await codes.consume(admin.id, hex("a")))).toBe(false);
    expect(unwrap(await codes.consume(admin.id, hex("c")))).toBe(true);
    expect(unwrap(await codes.consume(admin.id, hex("c")))).toBe(false);
    expect(unwrap(await codes.countUnused(admin.id))).toBe(1);
  });
});

describe("throttle repository", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  const at = (ms: number) => new Date(now.getTime() + ms);
  const policy = THROTTLE_POLICY.account;
  const reserve = (when: Date, key = hex("a")) =>
    createThrottleRepository(testDb.db).reserve({
      key,
      scope: "account",
      policy,
      now: when,
    });

  it("counts every attempt and locks at the threshold, for 1 minute doubling", async () => {
    for (let attempt = 1; attempt <= 4; attempt++) {
      expect(unwrap(await reserve(now))).toEqual({
        failures: attempt,
        allowed: true,
        lockedUntil: undefined,
      });
    }
    expect(unwrap(await reserve(now))).toEqual({
      failures: 5,
      allowed: true,
      lockedUntil: at(60_000),
    });
    // During the lock: counted, refused, and the lock grows.
    expect(unwrap(await reserve(at(1000)))).toEqual({
      failures: 6,
      allowed: false,
      lockedUntil: at(1000 + 120_000),
    });
  });

  it("checks no more of a parallel burst than the threshold allows", async () => {
    const burst = await Promise.all(
      Array.from({ length: 8 }, () => reserve(now)),
    );

    expect(
      burst.map(unwrap).filter((reservation) => reservation.allowed),
    ).toHaveLength(policy.lockAfter);
  });

  it("starts again once the window has passed", async () => {
    for (let attempt = 1; attempt <= 6; attempt++) {
      await reserve(now);
    }

    expect(unwrap(await reserve(at(policy.windowMs + 1)))).toEqual({
      failures: 1,
      allowed: true,
      lockedUntil: undefined,
    });
  });

  it("reports the latest lock among keys, and refunds a successful attempt", async () => {
    const throttles = createThrottleRepository(testDb.db);
    for (let attempt = 1; attempt <= 5; attempt++) {
      await reserve(now, hex("b"));
    }
    await reserve(now, hex("c"));

    expect(
      unwrap(await throttles.lockedUntil([hex("b"), hex("c")], now)),
    ).toEqual(at(60_000));
    unwrap(await throttles.refund(hex("b"), policy, at(60_000)));
    expect(
      unwrap(await throttles.lockedUntil([hex("b")], now)),
    ).toBeUndefined();
  });

  it("lifts the lock a refunded attempt set above the threshold, not a later one", async () => {
    const throttles = createThrottleRepository(testDb.db);
    for (let attempt = 1; attempt <= 5; attempt++) {
      await reserve(now);
    }
    // The owner, once the first lock is over: the right password, counted sixth.
    const owner = unwrap(await reserve(at(61_000)));
    expect(owner).toMatchObject({ allowed: true, failures: 6 });

    unwrap(await throttles.refund(hex("a"), policy, owner.lockedUntil));
    expect(
      unwrap(await throttles.lockedUntil([hex("a")], at(61_000))),
    ).toBeUndefined();

    // A concurrent failure extended the lock: that one stays.
    const own = unwrap(await reserve(at(200_000)));
    const later = unwrap(await reserve(at(200_001)));
    unwrap(await throttles.refund(hex("a"), policy, own.lockedUntil));
    expect(
      unwrap(await throttles.lockedUntil([hex("a")], at(200_001))),
    ).toEqual(later.lockedUntil);
  });

  it("caps the lock of a huge count instead of overflowing", async () => {
    await testDb.exec(
      `insert into login_throttles (key, scope, failures, window_started_at, attempt_allowed) values ('${hex("a")}', 'account', 5000, '${now.toISOString()}', true)`,
    );

    expect(unwrap(await reserve(now))).toEqual({
      failures: 5001,
      allowed: true,
      lockedUntil: at(policy.maxLockMs),
    });
  });

  it("clears keys, or every lock (CLI)", async () => {
    const throttles = createThrottleRepository(testDb.db);
    await reserve(now, hex("b"));
    await reserve(now, hex("c"));

    unwrap(await throttles.clear([hex("b")]));
    expect(unwrap(await throttles.clearAll())).toBe(1);
  });
});

describe("audit repository", () => {
  it("records events newest first, without secrets", async () => {
    const audit = createAuditRepository(testDb.db);
    const admin = await newAdmin();

    unwrap(
      await audit.record({
        actorId: admin.id,
        action: "auth.login_succeeded",
        ipHash: hex("b"),
        userAgent: "Mozilla/5.0",
      }),
    );
    unwrap(
      await audit.record({
        actorId: admin.id,
        action: "auth.password_changed",
        diff: { password: "hunter2", revokedCount: 2 },
      }),
    );

    const entries = unwrap(await audit.list({ limit: 10, offset: 0 }));
    expect(entries.map((entry) => entry.action)).toEqual([
      "auth.password_changed",
      "auth.login_succeeded",
    ]);
    expect(entries[0]?.diff).toEqual({
      password: "[REDACTED]",
      revokedCount: 2,
    });
  });

  it("counts recent events of one kind", async () => {
    const audit = createAuditRepository(testDb.db);
    await newAdmin();
    unwrap(
      await audit.record({ actorId: ADMIN_ID, action: "auth.account_locked" }),
    );

    expect(
      unwrap(
        await audit.countSince(
          "auth.account_locked",
          new Date(Date.now() - 60_000),
        ),
      ),
    ).toBe(1);
    expect(unwrap(await audit.countSince("auth.signed_out", new Date(0)))).toBe(
      0,
    );
  });
});
