import { describe, expect, it } from "vitest";

import {
  MAX_ARRAY_ITEMS,
  MAX_STRING_LENGTH,
  REDACTED,
  redact,
  redactRecord,
  scrubSecrets,
} from "./redact";

// Generous bound: the quadratic regex this replaces took ~7 s on 100k chars.
const LINEAR_TIME_BUDGET_MS = 100;

function elapsedMs(work: () => unknown): number {
  const start = performance.now();
  work();
  return performance.now() - start;
}

describe("redact — sensitive keys", () => {
  it.each([
    "password",
    "newPassword",
    "DBPassword",
    "SMTPPassword",
    "passwordHash",
    "passcode",
    "passphrase",
    "pass",
    "pw",
    "TOTP",
    "otp",
    "otpauthUrl",
    "accessToken",
    "refresh_token",
    "APIToken",
    "CSRFToken",
    "JWTToken",
    "tokens",
    "clientSecret",
    "AWSSecret",
    "secrets",
    "apiKey",
    "x-api-key",
    "accessKey",
    "access_key",
    "authorization",
    "auth",
    "bearer",
    "jwt",
    "cookie",
    "cookies",
    "session",
    "sessionId",
    "sid",
    "credentials",
    "recoveryCode",
    "DATABASE_URL",
    "connectionString",
    "dsn",
    "salt",
    "pin",
  ])("replaces the value of the sensitive key %s", (key) => {
    expect(redact({ [key]: "s3cr3t" })).toEqual({ [key]: REDACTED });
  });

  it.each([
    "footprint",
    "description",
    "locale",
    "hotpath",
    "author",
    "code",
    "key",
    "passengers",
  ])("keeps the value of the harmless key %s", (key) => {
    expect(redact({ [key]: "value" })).toEqual({ [key]: "value" });
  });
});

describe("redact — secrets inside values", () => {
  it("masks email addresses wherever they appear", () => {
    const output = redact({
      email: "jane.doe@example.com",
      note: "reply to jane@example.com today",
    });

    expect(output).toEqual({
      email: "j***@example.com",
      note: "reply to j***@example.com today",
    });
  });

  it.each([
    [
      "postgres://neon_user:Abc$!def@ep-cool.eu.aws.neon.tech/db",
      "postgres://[REDACTED]@ep-cool.eu.aws.neon.tech/db",
    ],
    ["https://user:secretpw@example.com/x", "https://[REDACTED]@example.com/x"],
    // An unencoded "@" inside the password: everything up to the host goes.
    ["postgresql://u:pa@ss@host/db", "postgresql://[REDACTED]@host/db"],
    [
      "Authorization: Bearer abc.DEF-123_xyz",
      "Authorization: Bearer [REDACTED]",
    ],
    [
      "jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl end",
      "jwt [REDACTED] end",
    ],
    [
      "GET /callback?code=zzz&state=ok&token=abc",
      "GET /callback?code=[REDACTED]&state=ok&token=[REDACTED]",
    ],
    ["login failed: password=hunter2", "login failed: password=[REDACTED]"],
  ])("scrubs credentials from %j", (input, expected) => {
    expect(scrubSecrets(input)).toBe(expected);
  });

  it("caps long strings so a single value cannot flood a log line", () => {
    const output = scrubSecrets("x".repeat(MAX_STRING_LENGTH + 10));

    expect(output.startsWith("x".repeat(MAX_STRING_LENGTH))).toBe(true);
    expect(output).toContain("[+10 chars]");
  });

  it.each([
    ["a run without @", "a".repeat(200_000)],
    ["a run of dotted labels", "a.".repeat(100_000) + "@"],
    ["a domain without a dot", "x@" + "a".repeat(200_000)],
    ["a fake scheme", "a".repeat(200_000) + "://"],
  ])("scrubs %s in linear time (no ReDoS)", (_label, input) => {
    expect(elapsedMs(() => scrubSecrets(input))).toBeLessThan(
      LINEAR_TIME_BUDGET_MS,
    );
  });
});

describe("redact — structures", () => {
  it("walks nested objects and arrays", () => {
    const input = { user: { name: "Jane", sessions: [{ token: "t-1" }] } };

    expect(redact(input)).toEqual({
      user: { name: "Jane", sessions: REDACTED },
    });
  });

  it("never mutates its input", () => {
    const input = {
      password: "hunter2",
      nested: { token: "t", email: "a@b.io" },
    };
    const snapshot = structuredClone(input);

    redact(input);

    expect(input).toEqual(snapshot);
  });

  it("serialises errors with their own fields and cause", () => {
    const error = Object.assign(new Error("No account for jane@example.com"), {
      code: "E_NO_ACCOUNT",
      cause: new Error("lookup failed"),
    });

    expect(redact({ error })).toMatchObject({
      error: {
        name: "Error",
        message: "No account for j***@example.com",
        code: "E_NO_ACCOUNT",
        cause: { name: "Error", message: "lookup failed" },
      },
    });
  });

  it("serialises maps, sets, URLs and headers instead of hiding them", () => {
    const output = redact({
      map: new Map([
        ["apiKey", "k"],
        ["region", "eu"],
      ]),
      set: new Set(["a", "b"]),
      url: new URL("https://user:pw@example.com/cb?token=abc"),
      headers: new Headers({ cookie: "session=1", accept: "text/html" }),
    });

    expect(output).toEqual({
      map: { apiKey: REDACTED, region: "eu" },
      set: ["a", "b"],
      url: "https://[REDACTED]@example.com/cb?token=[REDACTED]",
      headers: { accept: "text/html", cookie: REDACTED },
    });
  });

  it("summarises binary data instead of dumping every byte", () => {
    expect(redact({ body: new Uint8Array(1024) })).toEqual({
      body: "[Binary 1024 bytes]",
    });
  });

  it("caps long arrays", () => {
    const output = redact(
      Array.from({ length: MAX_ARRAY_ITEMS + 5 }, (_, i) => i),
    );

    expect(output).toHaveLength(MAX_ARRAY_ITEMS + 1);
    expect((output as unknown[]).at(-1)).toBe("[+5 items]");
  });

  it("replaces circular references instead of looping", () => {
    const input: Record<string, unknown> = { name: "loop" };
    input.self = input;

    expect(redact(input)).toEqual({ name: "loop", self: "[Circular]" });
  });

  it("keeps an object shared by two branches, which is not circular", () => {
    const shared = { id: 1 };

    expect(redact({ left: shared, right: shared })).toEqual({
      left: { id: 1 },
      right: { id: 1 },
    });
  });

  it("truncates structures nested deeper than eight levels", () => {
    const deep = {
      l1: {
        l2: { l3: { l4: { l5: { l6: { l7: { l8: { l9: "deep" } } } } } } },
      },
    };

    expect(redact(deep)).toEqual({
      l1: { l2: { l3: { l4: { l5: { l6: { l7: { l8: "[Truncated]" } } } } } } },
    });
  });

  it("converts values JSON cannot encode, including invalid dates", () => {
    const output = redact({
      at: new Date("2026-01-01T00:00:00.000Z"),
      broken: new Date("not a date"),
      big: 10n,
    });

    expect(output).toEqual({
      at: "2026-01-01T00:00:00.000Z",
      broken: "[Invalid Date]",
      big: "10",
    });
  });

  it.each([42, true, null, undefined])(
    "returns the primitive %s unchanged",
    (value) => {
      expect(redact(value)).toBe(value);
    },
  );
});

describe("redactRecord", () => {
  it("redacts a record and returns a new record", () => {
    const input = { password: "hunter2", locale: "fr" };

    const output = redactRecord(input);

    expect(output).toEqual({ password: REDACTED, locale: "fr" });
    expect(output).not.toBe(input);
  });
});
