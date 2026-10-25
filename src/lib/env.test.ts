import { describe, expect, it } from "vitest";

import { EnvValidationError, parseClientEnv, parseServerEnv } from "./env";

function captureEnvError(parse: () => unknown): EnvValidationError {
  try {
    parse();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected an EnvValidationError to be thrown");
}

describe("parseServerEnv", () => {
  it("applies defaults when optional variables are missing", () => {
    expect(parseServerEnv({})).toEqual({
      NODE_ENV: "development",
      LOG_LEVEL: "info",
    });
  });

  it("returns a valid environment, without unrelated variables", () => {
    const env = parseServerEnv({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      LOG_LEVEL: "warn",
      PATH: "/usr/bin",
    });

    expect(env).toEqual({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      LOG_LEVEL: "warn",
    });
  });

  it("treats an empty value as unset", () => {
    expect(parseServerEnv({ LOG_LEVEL: "", VERCEL_ENV: "" })).toEqual({
      NODE_ENV: "development",
      LOG_LEVEL: "info",
    });
  });

  it("names the invalid variable", () => {
    const error = captureEnvError(() =>
      parseServerEnv({ LOG_LEVEL: "verbose" }),
    );

    expect(error.message).toContain("LOG_LEVEL");
  });

  it("reports every invalid variable at once", () => {
    const error = captureEnvError(() =>
      parseServerEnv({ LOG_LEVEL: "verbose", VERCEL_ENV: "staging" }),
    );

    expect(error.issues).toHaveLength(2);
    expect(error.issues.join("\n")).toMatch(
      /LOG_LEVEL[\s\S]*VERCEL_ENV|VERCEL_ENV[\s\S]*LOG_LEVEL/,
    );
  });

  it("never echoes the rejected value, which could be a secret", () => {
    const error = captureEnvError(() =>
      parseServerEnv({ LOG_LEVEL: "s3cr3t-value" }),
    );

    expect(error.message).not.toContain("s3cr3t-value");
  });

  it.each([
    "postgres://app:pw@ep-cool.eu-central-1.aws.neon.tech/neondb?sslmode=require",
    "postgresql://app:pw@localhost:5432/portfolio",
  ])("accepts the database URL %s", (url) => {
    expect(parseServerEnv({ DATABASE_URL: url }).DATABASE_URL).toBe(url);
  });

  it("leaves the database URL optional until a page reads the database", () => {
    expect(parseServerEnv({ DATABASE_URL: "" }).DATABASE_URL).toBeUndefined();
  });

  it("rejects a database URL the Neon driver could not parse, without echoing it", () => {
    // Valid for the URL standard, but Neon re-parses the host and would quote
    // the whole connection string, password included, in its error.
    const error = captureEnvError(() =>
      parseServerEnv({
        DATABASE_URL: "postgres://u:s3cr3t-pw@ho%20st.neon.tech/db",
      }),
    );

    expect(error.message).toContain("DATABASE_URL");
    expect(error.message).not.toContain("s3cr3t-pw");
  });

  it("rejects a non-Postgres database URL without echoing its credentials", () => {
    const error = captureEnvError(() =>
      parseServerEnv({ DATABASE_URL: "https://app:s3cr3t-pw@example.com/db" }),
    );

    expect(error.message).toContain("DATABASE_URL");
    expect(error.message).not.toContain("s3cr3t-pw");
  });
});

describe("parseClientEnv", () => {
  it("accepts an http or https site URL", () => {
    expect(
      parseClientEnv({ NEXT_PUBLIC_SITE_URL: "https://example.com" }),
    ).toEqual({
      NEXT_PUBLIC_SITE_URL: "https://example.com",
    });
    expect(
      parseClientEnv({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }),
    ).toEqual({
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    });
  });

  it("allows the site URL to be unset", () => {
    expect(parseClientEnv({ NEXT_PUBLIC_SITE_URL: "" })).toEqual({});
  });

  it.each([
    "javascript:alert(1)",
    "ftp://example.com",
    "not a url",
    "https://example.com/blog",
    "https://example.com?ref=1",
    "https://example.com/#top",
  ])("rejects the site URL %j", (value) => {
    const error = captureEnvError(() =>
      parseClientEnv({ NEXT_PUBLIC_SITE_URL: value }),
    );

    expect(error.message).toContain("NEXT_PUBLIC_SITE_URL");
  });

  it("rejects credentials in the site URL without echoing them", () => {
    const error = captureEnvError(() =>
      parseClientEnv({
        NEXT_PUBLIC_SITE_URL: "https://admin:s3cr3t@example.com",
      }),
    );

    expect(error.message).toContain("NEXT_PUBLIC_SITE_URL");
    expect(error.message).not.toContain("s3cr3t");
  });
});

describe("parseServerEnv — contact form", () => {
  it("accepts the contact services' settings", () => {
    expect(
      parseServerEnv({
        TURNSTILE_SITE_KEY: "0x4AAAAAAA",
        IP_HASH_SALT: "s".repeat(32),
        UPSTASH_REDIS_REST_URL: "https://eu1-x.upstash.io",
        CONTACT_TO_EMAIL: "prieto.orion@gmail.com",
      }),
    ).toMatchObject({
      TURNSTILE_SITE_KEY: "0x4AAAAAAA",
      UPSTASH_REDIS_REST_URL: "https://eu1-x.upstash.io",
    });
  });

  it.each([
    ["IP_HASH_SALT", "too-short-salt"],
    ["UPSTASH_REDIS_REST_URL", "http://eu1-x.upstash.io"],
    ["CONTACT_TO_EMAIL", "not-an-email"],
  ])("rejects an invalid %s without echoing it", (name, value) => {
    const error = captureEnvError(() => parseServerEnv({ [name]: value }));

    expect(error.message).toContain(name);
    expect(error.message).not.toContain(value);
  });
});
