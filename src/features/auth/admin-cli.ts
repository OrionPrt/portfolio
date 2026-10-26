import { randomUUID } from "node:crypto";

import { z } from "zod";

import { isLocalDatabase } from "@/db/local";
import type { Database } from "@/db/types";
import { DEVELOPMENT_SEALING_KEY } from "@/lib/deployment";
import { err, ok, type Result } from "@/lib/result";

import { createAuditRepository } from "./audit-repository";
import {
  issueRecoveryCodes,
  totpEnrollment,
  type TotpEnrollment,
} from "./enrollment";
import { checkPasswordPolicy, hashPassword } from "./password";
import { createRecoveryCodesRepository } from "./recovery-codes-repository";
import { parseSealingKey, sealSecret } from "./secret-box";
import { createSessionsRepository } from "./sessions-repository";
import { createThrottleRepository } from "./throttle-repository";
import { generateTotpSecret, matchTotp } from "./totp";
import { compactCode } from "./totp-code";
import {
  createUsersRepository,
  type AdminUserRecord,
} from "./users-repository";
import type { PasswordProblem } from "./vocabulary";

// What the admin CLI (scripts/admin) does, apart from its prompts. The second
// factor is set up here, never on the web: no one holding only the password
// can enroll an authenticator of their own.

/**
 * The key that seals TOTP secrets. Against a remote (production) database
 * the real TOTP_ENCRYPTION_KEY is required: a secret sealed with the public
 * development key would be readable, and production could not open it.
 */
export function cliSealingKey(
  databaseUrl: string,
  encodedKey: string | undefined,
): Result<Uint8Array, "missing" | "development_key"> {
  const parsed =
    encodedKey === undefined ? undefined : parseSealingKey(encodedKey);
  const key = parsed?.ok === true ? parsed.data : undefined;
  if (isLocalDatabase(databaseUrl)) {
    return ok(key ?? DEVELOPMENT_SEALING_KEY);
  }
  if (key === undefined) {
    return err("missing");
  }
  return Buffer.from(key).equals(Buffer.from(DEVELOPMENT_SEALING_KEY))
    ? err("development_key")
    : ok(key);
}

/** What is wrong with an email and password, whatever they are for. */
type CredentialProblem = "invalid_email" | PasswordProblem | "breached";

export type CreateAdminProblem = CredentialProblem | "exists" | "unavailable";

interface NewAdminInput {
  readonly email: string;
  readonly password: string;
}

interface PrepareServices {
  readonly isBreached: (
    password: string,
  ) => Promise<Result<boolean, "unavailable">>;
}

/** An account ready to be created once its first TOTP code is checked. */
export interface PreparedAdmin {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly secret: Uint8Array;
  readonly enrollment: TotpEnrollment;
  readonly breachCheck: "passed" | "unavailable";
}

const EMAIL = z.email().max(254);

async function problemOf(
  { email, password }: NewAdminInput,
  { isBreached }: PrepareServices,
): Promise<CredentialProblem | "breach_check_unavailable" | undefined> {
  if (!EMAIL.safeParse(email).success) {
    return "invalid_email";
  }
  const policy = checkPasswordPolicy(password, email);
  if (!policy.ok) {
    return policy.error;
  }
  const breached = await isBreached(password);
  if (!breached.ok) {
    return "breach_check_unavailable";
  }
  return breached.data ? "breached" : undefined;
}

/**
 * Checks the email and password (one account only, a long password found in
 * no known breach) and draws the TOTP secret to show. Nothing is stored yet.
 */
export async function prepareAdminAccount(
  db: Database,
  input: NewAdminInput,
  services: PrepareServices,
): Promise<Result<PreparedAdmin, CreateAdminProblem>> {
  const email = input.email.trim().toLowerCase();
  const problem = await problemOf(
    { email, password: input.password },
    services,
  );
  if (problem !== undefined && problem !== "breach_check_unavailable") {
    return err(problem);
  }
  const existing = await createUsersRepository(db).count();
  if (!existing.ok || existing.data > 0) {
    return err(existing.ok ? "exists" : "unavailable");
  }
  const secret = generateTotpSecret();
  return ok({
    id: randomUUID(),
    email,
    passwordHash: await hashPassword(input.password),
    secret,
    enrollment: totpEnrollment(secret, email),
    breachCheck: problem === undefined ? "passed" : "unavailable",
  });
}

interface EnrollServices {
  readonly sealingKey: Uint8Array;
  readonly now: Date;
}

export type EnrollProblem = "code_refused" | "exists" | "unavailable";

/**
 * Creates the account once the authenticator's first code matches: the
 * second factor is on from the start, and the recovery codes come back to be
 * shown once. The database allows a single account, whatever runs at once.
 */
export async function createAdminAccount(
  db: Database,
  prepared: PreparedAdmin,
  code: string,
  { sealingKey, now }: EnrollServices,
): Promise<
  Result<
    {
      readonly user: AdminUserRecord;
      readonly recoveryCodes: readonly string[];
    },
    EnrollProblem
  >
> {
  const step = matchTotp(prepared.secret, compactCode(code), now);
  if (step === undefined) {
    return err("code_refused");
  }
  const users = createUsersRepository(db);
  const created = await users.createEnrolled({
    id: prepared.id,
    email: prepared.email,
    passwordHash: prepared.passwordHash,
    totpSecret: sealSecret(prepared.secret, sealingKey, prepared.id),
    totpLastStep: step,
  });
  if (!created.ok) {
    const existing = await users.count();
    return err(existing.ok && existing.data > 0 ? "exists" : "unavailable");
  }
  const codes = await issueRecoveryCodes(created.data.id, {
    recoveryCodes: createRecoveryCodesRepository(db),
  });
  if (!codes.ok) {
    return err("unavailable");
  }
  await createAuditRepository(db).record({
    actorId: created.data.id,
    action: "auth.totp_enabled",
  });
  return ok({ user: created.data, recoveryCodes: codes.data });
}

/** Lifts every lock: there is one account, and the CLI needs database access. */
export function unlockAll(db: Database): Promise<Result<number>> {
  return createThrottleRepository(db).clearAll();
}

export type SetPasswordProblem =
  CredentialProblem | "unknown_account" | "unavailable";

/** A new password, checked like a new account's: nothing is stored yet. */
export interface PreparedPassword {
  readonly user: AdminUserRecord;
  readonly passwordHash: string;
  readonly breachCheck: "passed" | "unavailable";
}

export async function prepareNewPassword(
  db: Database,
  input: NewAdminInput,
  services: PrepareServices,
): Promise<Result<PreparedPassword, SetPasswordProblem>> {
  const found = await createUsersRepository(db).findByEmail(input.email);
  if (!found.ok || found.data === undefined) {
    return err(found.ok ? "unknown_account" : "unavailable");
  }
  const user = found.data;
  const problem = await problemOf(
    { email: user.email, password: input.password },
    services,
  );
  if (problem !== undefined && problem !== "breach_check_unavailable") {
    return err(problem);
  }
  return ok({
    user,
    passwordHash: await hashPassword(input.password),
    breachCheck: problem === undefined ? "passed" : "unavailable",
  });
}

/**
 * Break-glass for the password, forgotten or leaked: whoever holds a leaked
 * one can keep the second factor locked, and the web asks for a code to
 * change it. Sets it, ends every session and lifts every lock; returns the
 * number of sessions ended.
 */
export async function setPassword(
  db: Database,
  { user, passwordHash }: PreparedPassword,
): Promise<Result<number>> {
  const updated = await createUsersRepository(db).updatePassword(
    user.id,
    passwordHash,
  );
  const ended = updated.ok
    ? await createSessionsRepository(db).deleteForUser(user.id)
    : updated;
  if (!ended.ok) {
    return ended;
  }
  const unlocked = await unlockAll(db);
  if (!unlocked.ok) {
    return unlocked;
  }
  await createAuditRepository(db).record({
    actorId: user.id,
    action: "auth.password_changed",
    diff: { revokedCount: ended.data, method: "cli" },
  });
  return ok(ended.data);
}

/** A new authenticator to show for the account; undefined for an unknown email. */
export async function prepareSecondFactorReset(
  db: Database,
  email: string,
): Promise<
  Result<
    | {
        readonly user: AdminUserRecord;
        readonly secret: Uint8Array;
        readonly enrollment: TotpEnrollment;
      }
    | undefined
  >
> {
  const found = await createUsersRepository(db).findByEmail(email);
  if (!found.ok || found.data === undefined) {
    return found.ok ? ok(undefined) : found;
  }
  const secret = generateTotpSecret();
  return ok({
    user: found.data,
    secret,
    enrollment: totpEnrollment(secret, found.data.email),
  });
}

/**
 * Break-glass, when both the phone and the recovery codes are lost: once the
 * new authenticator's first code matches, every session ends, then the
 * recovery codes and the second factor are replaced, in that order: the old
 * codes may be the leaked ones, so a failure halfway leaves none of them.
 */
export async function resetSecondFactor(
  db: Database,
  {
    user,
    secret,
  }: { readonly user: AdminUserRecord; readonly secret: Uint8Array },
  code: string,
  { sealingKey, now }: EnrollServices,
): Promise<Result<readonly string[], "code_refused" | "unavailable">> {
  const step = matchTotp(secret, compactCode(code), now);
  if (step === undefined) {
    return err("code_refused");
  }
  const ended = await createSessionsRepository(db).deleteForUser(user.id);
  const codes = ended.ok
    ? await issueRecoveryCodes(user.id, {
        recoveryCodes: createRecoveryCodesRepository(db),
      })
    : ended;
  const replaced = codes.ok
    ? await createUsersRepository(db).replaceTotp(
        user.id,
        sealSecret(secret, sealingKey, user.id),
        step,
      )
    : codes;
  if (!codes.ok || !replaced.ok) {
    return err("unavailable");
  }
  await createAuditRepository(db).record({
    actorId: user.id,
    action: "auth.totp_reset",
  });
  return ok(codes.data);
}
