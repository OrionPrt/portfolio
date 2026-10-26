import { randomUUID } from "node:crypto";

import { vi } from "vitest";

import type { Database } from "@/db/types";
import {
  createAuthDependencies,
  type AuthDependencies,
} from "@/features/auth/auth-dependencies";
import type { AttemptContext } from "@/features/auth/attempts";
import { hashPassword } from "@/features/auth/password";
import { sealSecret } from "@/features/auth/secret-box";
import { generateHotp, TOTP_PERIOD_SECONDS } from "@/features/auth/totp";
import {
  createUsersRepository,
  type AdminUserRecord,
} from "@/features/auth/users-repository";
import { ok } from "@/lib/result";

export const AUTH_SECRETS = {
  sealingKey: new Uint8Array(32).fill(9),
  salt: "s".repeat(32),
} as const;

export const ADMIN_EMAIL = "admin@example.com";
export const ADMIN_PASSWORD = "a long and unique test password";
export const TOTP_SECRET = new TextEncoder().encode("12345678901234567890");

export const CONTEXT: AttemptContext = {
  network: "203.0.113.7",
  networkHash: "b".repeat(64),
  userAgent: "Mozilla/5.0",
};

/** A clock the test moves forward: TOTP steps must increase (replay). */
export function testClock(start = new Date("2026-10-25T12:00:00Z")) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current = new Date(current.getTime() + ms);
    },
  };
}

export function totpCodeAt(time: Date): string {
  return generateHotp(
    TOTP_SECRET,
    Math.floor(time.getTime() / 1000 / TOTP_PERIOD_SECONDS),
  );
}

/** Tasks the flows deferred (Next.js `after`): run them with flushDeferred(). */
const deferred: (() => Promise<unknown>)[] = [];

export async function flushDeferred(): Promise<void> {
  while (deferred.length > 0) {
    const task = deferred.shift();
    await task?.();
  }
}

export function testDependencies(
  db: Database,
  clock: { now: () => Date },
  overrides: Partial<AuthDependencies> = {},
): AuthDependencies {
  return {
    ...createAuthDependencies(db, AUTH_SECRETS, {
      alertLockout: vi.fn(),
      isBreached: () => Promise.resolve(ok(false)),
      defer: (task) => {
        deferred.push(task);
      },
      now: clock.now,
    }),
    ...overrides,
  };
}

let passwordHash: Promise<string> | undefined;

/** The admin, created as the CLI does: its second factor already on (step 0). */
export async function createAdmin(db: Database): Promise<AdminUserRecord> {
  passwordHash ??= hashPassword(ADMIN_PASSWORD);
  const id = randomUUID();
  const created = await createUsersRepository(db).createEnrolled({
    id,
    email: ADMIN_EMAIL,
    passwordHash: await passwordHash,
    totpSecret: sealSecret(TOTP_SECRET, AUTH_SECRETS.sealingKey, id),
    totpLastStep: 0,
  });
  if (!created.ok) {
    throw new Error("Could not create the admin");
  }
  return created.data;
}
