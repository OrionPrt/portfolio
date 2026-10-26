import type { Database } from "@/db/types";
import type { Result } from "@/lib/result";

import {
  createAuditRepository,
  type AuditRepository,
} from "./audit-repository";
import {
  createRecoveryCodesRepository,
  type RecoveryCodesRepository,
} from "./recovery-codes-repository";
import {
  createSessionsRepository,
  type SessionsRepository,
} from "./sessions-repository";
import {
  createThrottleRepository,
  type ThrottleRepository,
} from "./throttle-repository";
import {
  createUsersRepository,
  type UsersRepository,
} from "./users-repository";

export interface AuthSecrets {
  /** Seals TOTP secrets. */
  readonly sealingKey: Uint8Array;
  /** Keys the hashes of networks and typed emails. */
  readonly salt: string;
}

export interface LockoutAlert {
  readonly at: Date;
  readonly until: Date;
}

/** What the sign-in flows run on: repositories, secrets and side services. */
export interface AuthDependencies extends AuthSecrets {
  readonly users: UsersRepository;
  readonly sessions: SessionsRepository;
  readonly recoveryCodes: RecoveryCodesRepository;
  readonly throttles: ThrottleRepository;
  readonly audit: Pick<AuditRepository, "record" | "countSince">;
  /** Tells the owner their account just got locked (after the response). */
  readonly alertLockout: (alert: LockoutAlert) => void;
  readonly isBreached: (
    password: string,
  ) => Promise<Result<boolean, "unavailable">>;
  /**
   * Runs a task after the response (Next.js `after`): failure audits, so a
   * real account answers no slower than an unknown one.
   */
  readonly defer: (task: () => Promise<unknown>) => void;
  readonly now: () => Date;
}

type AuthServices = Pick<
  AuthDependencies,
  "alertLockout" | "isBreached" | "defer" | "now"
>;

export function createAuthDependencies(
  db: Database,
  secrets: AuthSecrets,
  services: AuthServices,
): AuthDependencies {
  return {
    ...secrets,
    ...services,
    users: createUsersRepository(db),
    sessions: createSessionsRepository(db),
    recoveryCodes: createRecoveryCodesRepository(db),
    throttles: createThrottleRepository(db),
    audit: createAuditRepository(db),
  };
}
