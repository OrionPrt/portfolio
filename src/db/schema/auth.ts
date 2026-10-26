import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { timestamps } from "./columns";
import { MAX_USER_AGENT_LENGTH } from "./contact";
import { sessionStageEnum, throttleScopeEnum } from "./enums";

// CHECK constraints are DDL: the constant patterns below are inlined with
// sql.raw, never built from input.
const SHA256_HEX = sql.raw("'^[0-9a-f]{64}$'");
// "v1.<iv>.<ciphertext>.<tag>", base64url: AES-256-GCM (features/auth/secret-box).
const SEALED_SECRET = sql.raw(
  String.raw`'^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'`,
);
const AUDIT_ACTION = sql.raw(String.raw`'^[a-z]+(\.[a-z_]+)+$'`);
const MAX_EMAIL_LENGTH = sql.raw("254");
const MAX_USER_AGENT = sql.raw(String(MAX_USER_AGENT_LENGTH));

/**
 * The admin account (one, created from the CLI). The password is an argon2id
 * hash; the TOTP secret is sealed with AES-256-GCM, its key outside the
 * database. totp_last_step is the last time step accepted: a code is never
 * accepted twice.
 */
export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    totpSecret: text("totp_secret"),
    totpLastStep: bigint("totp_last_step", { mode: "number" }),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (t) => [
    check(
      "admin_users_email_format",
      sql`${t.email} = lower(${t.email}) and ${t.email} like '%_@_%' and char_length(${t.email}) <= ${MAX_EMAIL_LENGTH}`,
    ),
    check(
      "admin_users_password_hash_format",
      sql`${t.passwordHash} like '$argon2id$%'`,
    ),
    check(
      "admin_users_totp_secret_format",
      sql`${t.totpSecret} is null or ${t.totpSecret} ~ ${SEALED_SECRET}`,
    ),
    check(
      "admin_users_totp_enabled_with_secret",
      sql`${t.totpEnabledAt} is null or ${t.totpSecret} is not null`,
    ),
    check(
      "admin_users_totp_last_step_positive",
      sql`${t.totpLastStep} is null or ${t.totpLastStep} >= 0`,
    ),
    // One account, whatever runs at once: two CLI runs cannot create two.
    uniqueIndex("admin_users_single_row").on(sql`(true)`),
  ],
);

/**
 * Sessions, stored by the SHA-256 of their token: the token itself only lives
 * in the visitor's cookie. A session expires at expires_at, or earlier when
 * idle (last_seen_at, see features/auth/session).
 */
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    stage: sessionStageEnum("stage").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
  },
  (t) => [
    check("admin_sessions_id_format", sql`${t.id} ~ ${SHA256_HEX}`),
    check(
      "admin_sessions_expiry_after_creation",
      sql`${t.expiresAt} > ${t.createdAt}`,
    ),
    check(
      "admin_sessions_ip_hash_format",
      sql`${t.ipHash} is null or ${t.ipHash} ~ ${SHA256_HEX}`,
    ),
    check(
      "admin_sessions_user_agent_length",
      sql`${t.userAgent} is null or char_length(${t.userAgent}) <= ${MAX_USER_AGENT}`,
    ),
    index("admin_sessions_user_idx").on(t.userId),
  ],
);

/** One-time recovery codes, stored as SHA-256 hashes (they carry 120 random bits). */
export const recoveryCodes = pgTable(
  "recovery_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("recovery_codes_hash_format", sql`${t.codeHash} ~ ${SHA256_HEX}`),
    unique("recovery_codes_user_code_key").on(t.userId, t.codeHash),
  ],
);

/**
 * Failed sign-ins, counted per network and per (network, account), under a
 * keyed hash: neither the address nor the email typed is stored.
 */
export const loginThrottles = pgTable(
  "login_throttles",
  {
    key: text("key").primaryKey(),
    scope: throttleScopeEnum("scope").notNull(),
    failures: integer("failures").notNull().default(0),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    /** Whether the last attempt counted here came while no lock ran. */
    attemptAllowed: boolean("attempt_allowed").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (t) => [
    check("login_throttles_key_format", sql`${t.key} ~ ${SHA256_HEX}`),
    check("login_throttles_failures_positive", sql`${t.failures} >= 0`),
  ],
);

/**
 * What happened in the admin, and who did it. diff never holds a secret
 * (password, TOTP secret or code, token); the network is a keyed hash.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    actorId: uuid("actor_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    diff: jsonb("diff"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "audit_logs_action_format",
      sql`${t.action} ~ ${AUDIT_ACTION} and char_length(${t.action}) <= 64`,
    ),
    check(
      "audit_logs_ip_hash_format",
      sql`${t.ipHash} is null or ${t.ipHash} ~ ${SHA256_HEX}`,
    ),
    check(
      "audit_logs_user_agent_length",
      sql`${t.userAgent} is null or char_length(${t.userAgent}) <= ${MAX_USER_AGENT}`,
    ),
    index("audit_logs_created_idx").on(t.createdAt.desc()),
  ],
);
