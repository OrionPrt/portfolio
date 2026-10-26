import "server-only";

import {
  allowsDevelopmentSecrets,
  DEVELOPMENT_IP_HASH_SALT,
  DEVELOPMENT_SEALING_KEY,
} from "@/lib/deployment";
import { parseServerEnv } from "@/lib/env";
import { mailConfigOf, type MailConfig } from "@/lib/mail";

import { parseSealingKey } from "./secret-box";

type EnvSource = Readonly<Record<string, string | undefined>>;

export type AuthConfig =
  | {
      readonly enabled: true;
      /** Seals TOTP secrets (AES-256-GCM). */
      readonly sealingKey: Uint8Array;
      /** Keys the hashes of networks and typed emails (sessions, throttling). */
      readonly ipHashSalt: string;
      /** Undefined: lockouts are logged and audited, but nobody is emailed. */
      readonly alertMail: MailConfig | undefined;
    }
  | {
      readonly enabled: false;
      /** Names of the missing variables, for the logs. */
      readonly missing: readonly string[];
    };

function sealingKeyOf(encoded: string | undefined): Uint8Array | undefined {
  if (encoded === undefined) {
    return undefined;
  }
  const parsed = parseSealingKey(encoded);
  return parsed.ok ? parsed.data : undefined;
}

function isDevelopmentKey(key: Uint8Array): boolean {
  return Buffer.from(key).equals(Buffer.from(DEVELOPMENT_SEALING_KEY));
}

/**
 * What the admin runs on. In production (Vercel or not) the sealing key and
 * the salt are required, and the public development key is refused: the
 * admin stays off rather than run on known secrets. In development and tests,
 * and on the E2E server, development defaults apply.
 */
export function authConfig(source: EnvSource = process.env): AuthConfig {
  const env = parseServerEnv(source);
  const alertMail = mailConfigOf(env);
  const sealingKey = sealingKeyOf(env.TOTP_ENCRYPTION_KEY);

  if (allowsDevelopmentSecrets(env)) {
    return {
      enabled: true,
      sealingKey: sealingKey ?? DEVELOPMENT_SEALING_KEY,
      ipHashSalt: env.IP_HASH_SALT ?? DEVELOPMENT_IP_HASH_SALT,
      alertMail,
    };
  }
  const realKey =
    sealingKey === undefined || isDevelopmentKey(sealingKey)
      ? undefined
      : sealingKey;
  if (realKey === undefined || env.IP_HASH_SALT === undefined) {
    return {
      enabled: false,
      missing: [
        ...(realKey === undefined ? ["TOTP_ENCRYPTION_KEY"] : []),
        ...(env.IP_HASH_SALT === undefined ? ["IP_HASH_SALT"] : []),
      ],
    };
  }
  return {
    enabled: true,
    sealingKey: realKey,
    ipHashSalt: env.IP_HASH_SALT,
    alertMail,
  };
}
