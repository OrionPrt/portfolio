import { describe, expect, it } from "vitest";

import { contactConfig, TURNSTILE_TEST_KEYS } from "./config";

const SALT = "s".repeat(32);

/** A copy of the environment without the given variables. */
function without(
  env: Readonly<Record<string, string>>,
  ...names: readonly string[]
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter(([name]) => !names.includes(name)),
  );
}

const PRODUCTION = {
  VERCEL_ENV: "production",
  TURNSTILE_SITE_KEY: "0x4AAAAAAA-site",
  TURNSTILE_SECRET_KEY: "0x4AAAAAAA-secret",
  IP_HASH_SALT: SALT,
  UPSTASH_REDIS_REST_URL: "https://eu1-x.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token",
  RESEND_API_KEY: "re_123",
  CONTACT_TO_EMAIL: "prieto.orion@gmail.com",
};

describe("contactConfig", () => {
  it("runs on Cloudflare's test keys and in-memory limits in development", () => {
    expect(contactConfig({})).toEqual({
      enabled: true,
      turnstile: TURNSTILE_TEST_KEYS,
      ipHashSalt: expect.any(String) as unknown,
      upstash: undefined,
      mail: undefined,
    });
  });

  it("uses every real service in production", () => {
    expect(contactConfig(PRODUCTION)).toEqual({
      enabled: true,
      turnstile: { siteKey: "0x4AAAAAAA-site", secretKey: "0x4AAAAAAA-secret" },
      ipHashSalt: SALT,
      upstash: { url: "https://eu1-x.upstash.io", token: "token" },
      mail: {
        apiKey: "re_123",
        to: "prieto.orion@gmail.com",
        from: "Portfolio <onboarding@resend.dev>",
      },
    });
  });

  it("accepts the variable names of Vercel's Upstash integration", () => {
    const config = contactConfig({
      ...without(
        PRODUCTION,
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
      ),
      KV_REST_API_URL: "https://eu1-y.upstash.io",
      KV_REST_API_TOKEN: "kv-token",
    });

    expect(config.enabled && config.upstash).toEqual({
      url: "https://eu1-y.upstash.io",
      token: "kv-token",
    });
  });

  it.each(["production", "preview"])(
    "disables the form on %s while an anti-abuse service is missing",
    (environment) => {
      expect(contactConfig({ VERCEL_ENV: environment })).toEqual({
        enabled: false,
        missing: [
          "TURNSTILE_SITE_KEY",
          "TURNSTILE_SECRET_KEY",
          "IP_HASH_SALT",
          "UPSTASH_REDIS_REST_URL",
          "UPSTASH_REDIS_REST_TOKEN",
        ],
      });
    },
  );

  it.each(["production", "preview"])(
    "refuses Cloudflare's test keys on %s: they pass any token",
    (environment) => {
      expect(
        contactConfig({
          ...PRODUCTION,
          VERCEL_ENV: environment,
          TURNSTILE_SITE_KEY: TURNSTILE_TEST_KEYS.siteKey,
          TURNSTILE_SECRET_KEY: TURNSTILE_TEST_KEYS.secretKey,
        }),
      ).toEqual({
        enabled: false,
        missing: ["TURNSTILE_SECRET_KEY"],
      });
    },
  );

  it("still takes messages in production without email, which is only a notification", () => {
    const config = contactConfig(without(PRODUCTION, "RESEND_API_KEY"));

    expect(config.enabled).toBe(true);
    expect(config.enabled && config.mail).toBeUndefined();
  });
});
