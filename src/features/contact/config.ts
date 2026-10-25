import "server-only";

import { parseServerEnv } from "@/lib/env";

type EnvSource = Readonly<Record<string, string | undefined>>;

/** Cloudflare's documented test keys: they always pass. Development and CI only. */
export const TURNSTILE_TEST_KEYS = {
  siteKey: "1x00000000000000000000AA",
  secretKey: "1x0000000000000000000000000000000AA",
} as const;

// Hashes made with it only ever reach a development database.
const DEVELOPMENT_SALT = "development-only-salt-not-used-in-production";

/** Without a verified domain, Resend only sends from this address (P12 adds one). */
const DEFAULT_FROM = "Portfolio <onboarding@resend.dev>";

export interface UpstashConfig {
  readonly url: string;
  readonly token: string;
}

export interface MailConfig {
  readonly apiKey: string;
  readonly to: string;
  readonly from: string;
}

export type ContactConfig =
  | {
      readonly enabled: true;
      readonly turnstile: {
        readonly siteKey: string;
        readonly secretKey: string;
      };
      readonly ipHashSalt: string;
      /** Undefined: limits are kept in memory, per instance (development). */
      readonly upstash: UpstashConfig | undefined;
      /** Undefined: messages are stored, but nobody is notified. */
      readonly mail: MailConfig | undefined;
    }
  | {
      readonly enabled: false;
      /** Names of the missing variables, for the logs. */
      readonly missing: readonly string[];
    };

type ServerEnv = ReturnType<typeof parseServerEnv>;

/** Either naming: Upstash's own, or the one of Vercel's integration. */
function upstashOf(env: ServerEnv): UpstashConfig | undefined {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url !== undefined && token !== undefined ? { url, token } : undefined;
}

function mailOf(env: ServerEnv): MailConfig | undefined {
  return env.RESEND_API_KEY !== undefined && env.CONTACT_TO_EMAIL !== undefined
    ? {
        apiKey: env.RESEND_API_KEY,
        to: env.CONTACT_TO_EMAIL,
        from: env.CONTACT_FROM_EMAIL ?? DEFAULT_FROM,
      }
    : undefined;
}

/** Cloudflare's test secret passes any token: on Vercel it counts as unset. */
function realSecret(secretKey: string | undefined): string | undefined {
  return secretKey === TURNSTILE_TEST_KEYS.secretKey ? undefined : secretKey;
}

/** The production settings left unset, by variable name, for the logs. */
function missingSettings(env: ServerEnv): readonly string[] {
  const settings = [
    ["TURNSTILE_SITE_KEY", env.TURNSTILE_SITE_KEY],
    ["TURNSTILE_SECRET_KEY", realSecret(env.TURNSTILE_SECRET_KEY)],
    ["IP_HASH_SALT", env.IP_HASH_SALT],
    [
      "UPSTASH_REDIS_REST_URL",
      env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL,
    ],
    [
      "UPSTASH_REDIS_REST_TOKEN",
      env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN,
    ],
  ] as const;
  return settings
    .filter(([, value]) => value === undefined)
    .map(([name]) => name);
}

/**
 * What the contact form runs on. On Vercel (production and previews) every
 * anti-abuse service must be configured, or the form is disabled and visitors
 * are pointed to email and LinkedIn; elsewhere it falls back to test keys.
 */
export function contactConfig(source: EnvSource = process.env): ContactConfig {
  const env = parseServerEnv(source);
  const upstash = upstashOf(env);
  const mail = mailOf(env);

  if (env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview") {
    return {
      enabled: true,
      turnstile: {
        siteKey: env.TURNSTILE_SITE_KEY ?? TURNSTILE_TEST_KEYS.siteKey,
        secretKey: env.TURNSTILE_SECRET_KEY ?? TURNSTILE_TEST_KEYS.secretKey,
      },
      ipHashSalt: env.IP_HASH_SALT ?? DEVELOPMENT_SALT,
      upstash,
      mail,
    };
  }

  const siteKey = env.TURNSTILE_SITE_KEY;
  const secretKey = realSecret(env.TURNSTILE_SECRET_KEY);
  const ipHashSalt = env.IP_HASH_SALT;
  if (
    siteKey === undefined ||
    secretKey === undefined ||
    ipHashSalt === undefined ||
    upstash === undefined
  ) {
    return { enabled: false, missing: missingSettings(env) };
  }
  return {
    enabled: true,
    turnstile: { siteKey, secretKey },
    ipHashSalt,
    upstash,
    mail,
  };
}
