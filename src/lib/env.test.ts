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
