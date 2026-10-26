# Admin authentication — OWASP ASVS 5.0 self-assessment

- **Scope:** the admin's authentication and sessions (`src/features/auth`, `/admin`, `scripts/admin`), as built in P5 ([ADR-0006](../adr/0006-auth.md)).
- **Standard:** [OWASP ASVS 5.0.0](https://github.com/OWASP/ASVS/tree/master/5.0), chapters V6 (Authentication) and V7 (Session Management), levels 1 and 2.
- **Date:** 2026-10-26, updated the same day once the second factor moved to CLI enrollment. A self-assessment by the author, not an audit.

Legend: **Met**, **Partial** (met with a stated deviation), **N/A** (the feature does not exist here).

## Summary

| Chapter                  | Met | Partial | N/A |
| ------------------------ | --: | ------: | --: |
| V6 Authentication (L1–2) |  24 |       3 |   8 |
| V7 Session Mgmt (L1–2)   |  16 |       0 |   2 |

The three deviations: the breached-password check lets a change through when Have I Been Pwned cannot be reached (6.2.4, 6.2.12), and the TOTP window accepts one step either side of now (6.5.5).

## V6 Authentication

### V6.1 Authentication documentation

| #     | Lvl | Requirement (short)                              | Status | Evidence                                                                                                                                                                                                                                                                                                                         |
| ----- | --- | ------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1.1 | 1   | Rate limiting and anti-automation are documented | Met    | ADR-0006, "Lockout without self-inflicted denial of service"; `throttle-policy.ts`                                                                                                                                                                                                                                               |
| 6.1.2 | 2   | A list of context-specific words is documented   | Met    | `CONTEXT_WORDS` in `password.ts`: "orion", "prieto", "portfolio", plus the account's email and its local part                                                                                                                                                                                                                    |
| 6.1.3 | 2   | All authentication pathways are documented       | Met    | Three pathways: password + TOTP; password + recovery code; and break-glass from the CLI with database access (`admin:reset-totp`, which ends every session, enrolls a new authenticator in the terminal and prints new recovery codes; `admin:set-password`, which sets a new password, ends every session and lifts every lock) |

### V6.2 Password security

| #      | Lvl | Requirement (short)                                          | Status  | Evidence                                                                                                                                                                                  |
| ------ | --- | ------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.2.1  | 1   | At least 8 characters (15 recommended)                       | Met     | 15 minimum, counted in graphemes (`PASSWORD_LIMITS`)                                                                                                                                      |
| 6.2.2  | 1   | Users can change their password                              | Met     | Security page, `changePassword`                                                                                                                                                           |
| 6.2.3  | 1   | Change requires the current and the new password             | Met     | Current password and a TOTP code (`account-security.ts`)                                                                                                                                  |
| 6.2.4  | 1   | Checked against at least the top 3,000 passwords             | Partial | Checked against Have I Been Pwned, which includes them (CLI creation and change). If the service cannot be reached, the change goes through and `auth.breach_check_unavailable` is logged |
| 6.2.5  | 1   | No composition rules                                         | Met     | Length only                                                                                                                                                                               |
| 6.2.6  | 1   | `type=password`                                              | Met     | Login, security forms                                                                                                                                                                     |
| 6.2.7  | 1   | Paste and password managers allowed                          | Met     | No paste blocking; `autocomplete` = `username`, `current-password`, `new-password`                                                                                                        |
| 6.2.8  | 1   | Verified exactly as received (no truncation, no case change) | Met     | No truncation (128-character ceiling refused, not cut); only Unicode NFC normalization, as NIST SP 800-63B recommends, so the same characters typed on any keyboard match                 |
| 6.2.9  | 2   | At least 64 characters allowed                               | Met     | Up to 128                                                                                                                                                                                 |
| 6.2.10 | 2   | No periodic rotation                                         | Met     | None                                                                                                                                                                                      |
| 6.2.11 | 2   | The context words are refused                                | Met     | `checkPasswordPolicy` (CLI creation and change), `contains_context_word`                                                                                                                  |
| 6.2.12 | 2   | Checked against breached passwords                           | Partial | As 6.2.4                                                                                                                                                                                  |

### V6.3 General authentication security

| #     | Lvl | Requirement (short)                                     | Status | Evidence                                                                                                                                                                                                                                               |
| ----- | --- | ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 6.3.1 | 1   | Credential stuffing and brute force are prevented       | Met    | Lock per (network, account), per network, and per account's TOTP step from any network; each attempt reserved atomically before the check, so parallel attempts stay within the limits; dummy verification for unknown emails; E2E "locks an account…" |
| 6.3.2 | 1   | No default accounts                                     | Met    | The only account is created from the CLI, with the owner's email                                                                                                                                                                                       |
| 6.3.3 | 2   | Multi-factor authentication is required                 | Met    | TOTP on from the account's creation: the CLI enrolls it before writing the account, and the web never enrolls a factor; a partial session reaches only the second step (`requireAdmin`, `requireLoginStep`)                                            |
| 6.3.4 | 2   | No undocumented pathway; strength enforced consistently | Met    | The three pathways of 6.1.3; every page and action checks the session (`dal.ts`); E2E "keeps every admin page behind a full session"                                                                                                                   |

### V6.4 Authentication factor lifecycle and recovery

| #     | Lvl | Requirement (short)                                    | Status | Evidence                                                                                                                                                                                                                  |
| ----- | --- | ------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.4.1 | 1   | System-generated initial secrets are random and expire | N/A    | No initial password is generated: the owner sets it in the CLI                                                                                                                                                            |
| 6.4.2 | 1   | No password hints or secret questions                  | Met    | None                                                                                                                                                                                                                      |
| 6.4.3 | 2   | Password reset does not bypass MFA                     | Met    | No reset on the web. `admin:set-password` (CLI) needs the production database's credentials, which could rewrite the second factor anyway: it bypasses nothing that access does not already grant, and ends every session |
| 6.4.4 | 2   | A lost factor needs identity proofing as at enrollment | Met    | Recovery codes, issued at enrollment; otherwise `admin:reset-totp`, which needs what the enrollment needed: the production database's credentials and the sealing key, in the CLI                                         |

### V6.5 Multi-factor authentication

| #     | Lvl | Requirement (short)                                           | Status  | Evidence                                                                                                                                                                                                                                                 |
| ----- | --- | ------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.5.1 | 2   | Lookup secrets and TOTPs are usable once                      | Met     | `acceptTotpStep` (atomic, last step stored), `consume` of recovery codes; tests "replay", E2E "signs in with a recovery code, once"                                                                                                                      |
| 6.5.2 | 2   | Lookup secrets under 112 bits are hashed with a password hash | Met     | Recovery codes carry 120 bits: a plain SHA-256 is allowed                                                                                                                                                                                                |
| 6.5.3 | 2   | Secrets come from a CSPRNG                                    | Met     | `randomBytes`, `randomInt` (`node:crypto`)                                                                                                                                                                                                               |
| 6.5.4 | 2   | Lookup secrets carry at least 20 bits                         | Met     | 120 bits                                                                                                                                                                                                                                                 |
| 6.5.5 | 2   | TOTPs live 30 seconds at most                                 | Partial | 30-second steps, but the previous and the next step are accepted for clock drift (RFC 6238 §5.2): a code works for up to 90 seconds. Each code is accepted once; failures lock the account from the network, and its TOTP step after 10 from any network |

### V6.6 Out-of-band authentication, V6.8 Identity providers

| #           | Lvl | Requirement (short)                       | Status | Evidence                       |
| ----------- | --- | ----------------------------------------- | ------ | ------------------------------ |
| 6.6.1–6.6.3 | 2   | SMS/phone codes, out-of-band requests     | N/A    | No out-of-band factor          |
| 6.8.1–6.8.4 | 2   | Identity providers, assertions, SAML, JWT | N/A    | No identity provider (4 items) |

## V7 Session Management

### V7.1 Session management documentation

| #     | Lvl | Requirement (short)                              | Status | Evidence                                                                           |
| ----- | --- | ------------------------------------------------ | ------ | ---------------------------------------------------------------------------------- |
| 7.1.1 | 2   | Inactivity and absolute lifetimes are documented | Met    | 30 min idle, 8 h absolute; second login step 5 min (ADR-0006, `session-policy.ts`) |
| 7.1.2 | 2   | Concurrent sessions are documented               | Met    | No limit: one account, every session listed on the security page and revocable     |
| 7.1.3 | 2   | Federated sessions are documented                | N/A    | No federation                                                                      |

### V7.2 Fundamental session security

| #     | Lvl | Requirement (short)                               | Status | Evidence                                                                                                        |
| ----- | --- | ------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| 7.2.1 | 1   | Tokens are verified by a trusted backend          | Met    | Database lookup per request (`validateSessionToken`), in pages and actions                                      |
| 7.2.2 | 1   | Dynamic reference tokens, no static secret        | Met    | Random token per session                                                                                        |
| 7.2.3 | 1   | Reference tokens from a CSPRNG, 128 bits or more  | Met    | 256 bits (`session-token.ts`)                                                                                   |
| 7.2.4 | 1   | New token on authentication; the current one ends | Met    | New token at each step; the partial session is deleted; signing in ends the session the browser held (`signIn`) |

### V7.3 Session timeout

| #     | Lvl | Requirement (short)       | Status | Evidence                             |
| ----- | --- | ------------------------- | ------ | ------------------------------------ |
| 7.3.1 | 2   | Inactivity timeout        | Met    | 30 minutes (`isSessionLive`), tested |
| 7.3.2 | 2   | Absolute maximum lifetime | Met    | 8 hours (`sessionExpiry`), tested    |

### V7.4 Session termination

| #     | Lvl | Requirement (short)                                   | Status | Evidence                                                                                     |
| ----- | --- | ----------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| 7.4.1 | 1   | A terminated session cannot be used again             | Met    | Sign-out, revocation and expiry delete the row; E2E "…and signs out"                         |
| 7.4.2 | 1   | Disabling or deleting the account ends its sessions   | Met    | `on delete cascade`; `admin:reset-totp` also deletes every session                           |
| 7.4.3 | 2   | Option to end other sessions after a factor changes   | Met    | "Revoke every other session" on the security page; a password change ends them automatically |
| 7.4.4 | 2   | Logout is easy to reach from every authenticated page | Met    | "Se déconnecter" in the admin header                                                         |
| 7.4.5 | 2   | Administrators can end a user's sessions              | Met    | The one administrator ends their own sessions                                                |

### V7.5 Defenses against session abuse

| #     | Lvl | Requirement (short)                                                      | Status | Evidence                                                                 |
| ----- | --- | ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------ |
| 7.5.1 | 2   | Full re-authentication before changing authentication-related attributes | Met    | Password change and new recovery codes need the password and a TOTP code |
| 7.5.2 | 2   | Sessions are viewable, and revocable after re-authenticating             | Met    | Security page; revocation needs a TOTP code (`revokeSessions`)           |

### V7.6 Federated re-authentication

| #     | Lvl | Requirement (short)                             | Status | Evidence                               |
| ----- | --- | ----------------------------------------------- | ------ | -------------------------------------- |
| 7.6.1 | 2   | Session lifetimes between relying party and IdP | N/A    | No identity provider                   |
| 7.6.2 | 2   | Creating a session needs an explicit action     | Met    | Only the sign-in form starts a session |

## Beyond V6 and V7

Points from other chapters that the authentication relies on:

- **Cryptography (V11).** argon2id at OWASP's parameters; AES-256-GCM with a random 96-bit nonce and associated data; HMAC-SHA-256 for keyed hashes; constant-time comparisons for codes.
- **Logging (V16).** Authentication events are audited; logs never hold a password, code, token, secret or typed email, and failed inserts log their SQL state only.
- **Configuration (V13).** On Vercel, missing or development secrets turn the admin off rather than run on known values.
