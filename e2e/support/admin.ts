import { randomUUID } from "node:crypto";

import { hash } from "@node-rs/argon2";
import postgres from "postgres";

import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from "../../src/features/auth/recovery-codes";
import { sealSecret } from "../../src/features/auth/secret-box";
import {
  generateHotp,
  TOTP_PERIOD_SECONDS,
} from "../../src/features/auth/totp";
import { DEVELOPMENT_SEALING_KEY } from "../../src/lib/deployment";

import { ownerDatabaseUrl } from "./owner-database";

export const ADMIN_EMAIL = "admin@example.com";
export const ADMIN_PASSWORD = "a long e2e passphrase, never a real one";
/** The authenticator's secret, as admin:create would have shown it: 160 bits. */
const TOTP_SECRET = new TextEncoder().encode("e2e-only-totp-secret");

/**
 * Starts from one enrolled admin account, as `pnpm admin:create` leaves it
 * (the web server runs with the development sealing key), and no session,
 * lock or audit event. Returns the recovery codes it printed.
 */
export async function resetAdmin(): Promise<readonly string[]> {
  const sql = postgres(ownerDatabaseUrl(), {
    max: 1,
    onnotice: () => undefined,
  });
  const id = randomUUID();
  const recoveryCodes = generateRecoveryCodes();
  try {
    const passwordHash = await hash(ADMIN_PASSWORD, {
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    const totpSecret = sealSecret(TOTP_SECRET, DEVELOPMENT_SEALING_KEY, id);
    await sql.begin(async (transaction) => {
      await transaction`delete from audit_logs`;
      await transaction`delete from login_throttles`;
      await transaction`delete from admin_users`;
      await transaction`insert into admin_users (id, email, password_hash, totp_secret, totp_enabled_at) values (${id}, ${ADMIN_EMAIL}, ${passwordHash}, ${totpSecret}, now())`;
      for (const code of recoveryCodes) {
        const codeHash = hashRecoveryCode(normalizeRecoveryCode(code) ?? "");
        await transaction`insert into recovery_codes (user_id, code_hash) values (${id}, ${codeHash})`;
      }
    });
  } finally {
    await sql.end();
  }
  return recoveryCodes;
}

/**
 * Codes from the account's secret, like an authenticator app. Each call uses
 * a later time step than the last (a step is accepted once), waiting for the
 * clock when the next one is not yet within the accepted window.
 */
export function authenticator(): () => Promise<string> {
  let lastStep = -1;
  return async () => {
    const now = () => Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
    while (lastStep + 1 > now() + 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    lastStep = Math.max(now(), lastStep + 1);
    return generateHotp(TOTP_SECRET, lastStep);
  };
}

/**
 * A contact message straight in the database, unread, for the inbox tests.
 * Its subject is unique: other suites store messages at the same time.
 */
export async function insertContactMessage(subject: string): Promise<void> {
  const sql = postgres(ownerDatabaseUrl(), {
    max: 1,
    onnotice: () => undefined,
  });
  try {
    await sql`insert into contact_messages (name, email, subject, body, locale, ip_hash)
      values ('Ada Lovelace', 'ada@example.com', ${subject}, ${"Bonjour,\n\n<b>pas du HTML</b>\nÀ bientôt."}, 'fr', ${"e".repeat(64)})`;
  } finally {
    await sql.end();
  }
}
