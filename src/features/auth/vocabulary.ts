/**
 * The session cookie. "__Host-": the browser only accepts it Secure, from this
 * host, on Path=/ (no subdomain or path can set or shadow it).
 */
export const SESSION_COOKIE = "__Host-session";

/**
 * Where a session stands. Only "signed_in" opens the admin; after the
 * password, "totp_challenge" only reaches the second step, for 5 minutes.
 * The second factor is set up in the CLI, never on the web.
 */
export const SESSION_STAGES = ["totp_challenge", "signed_in"] as const;

export type SessionStage = (typeof SESSION_STAGES)[number];

/**
 * What a throttle row counts: one network; one account from one network; or
 * one account's TOTP codes from every network (second_factor), which only a
 * password holder reaches.
 */
export const THROTTLE_SCOPES = ["network", "account", "second_factor"] as const;

export type ThrottleScope = (typeof THROTTLE_SCOPES)[number];

/** Why a new password is refused (account security, CLI). */
export type PasswordProblem =
  "too_short" | "too_long" | "contains_context_word";

/** Events of the audit log (audit_logs.action). */
export const AUDIT_ACTIONS = [
  "auth.login_succeeded",
  "auth.login_failed",
  "auth.account_locked",
  "auth.totp_enabled",
  "auth.recovery_code_used",
  "auth.recovery_codes_regenerated",
  "auth.password_changed",
  "auth.session_revoked",
  "auth.signed_out",
  "auth.totp_reset",
  "contact.message_deleted",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
