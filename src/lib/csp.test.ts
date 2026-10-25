import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  CSP_REPORT_GROUP,
  CSP_REPORT_PATH,
  createNonce,
  CSP_MODE,
  cspHeaderName,
} from "./csp";

// Same pattern Next.js uses to read the nonce from the CSP header
// (next/dist/server/app-render/get-script-nonce-from-header.js).
const NEXT_NONCE_SOURCE = /^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/;
const NONCE = "bm9uY2Utc2VlZC0xMjM0NQ==";
const NONCE_BYTES = 16;

function sourcesOf(
  policy: string,
  directiveName: string,
): string[] | undefined {
  const directive = policy
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .find(([name]) => name === directiveName);
  return directive?.slice(1);
}

describe("createNonce", () => {
  it("returns 128 random bits encoded in base64 that Next.js can read", () => {
    const nonce = createNonce();

    expect(atob(nonce)).toHaveLength(NONCE_BYTES);
    expect(`'nonce-${nonce}'`).toMatch(NEXT_NONCE_SOURCE);
  });

  it("never repeats a nonce", () => {
    const nonces = new Set(Array.from({ length: 1000 }, () => createNonce()));

    expect(nonces.size).toBe(1000);
  });
});

describe("buildContentSecurityPolicy", () => {
  const production = buildContentSecurityPolicy({
    nonce: NONCE,
    mode: "enforce",
    isDev: false,
  });

  it("only runs scripts that carry the request nonce", () => {
    const scriptSources = sourcesOf(production, "script-src");

    expect(scriptSources).toEqual(
      expect.arrayContaining([`'nonce-${NONCE}'`, "'strict-dynamic'"]),
    );
    expect(scriptSources).not.toContain("'unsafe-inline'");
    expect(scriptSources).not.toContain("'unsafe-eval'");
  });

  it("allows eval in development only, for React debugging", () => {
    const development = buildContentSecurityPolicy({
      nonce: NONCE,
      mode: "report-only",
      isDev: true,
    });

    expect(sourcesOf(development, "script-src")).toContain("'unsafe-eval'");
  });

  it("locks down plugins, base URI, framing and form targets", () => {
    expect(sourcesOf(production, "default-src")).toEqual(["'self'"]);
    expect(sourcesOf(production, "object-src")).toEqual(["'none'"]);
    expect(sourcesOf(production, "base-uri")).toEqual(["'none'"]);
    expect(sourcesOf(production, "frame-ancestors")).toEqual(["'none'"]);
    expect(sourcesOf(production, "form-action")).toEqual(["'self'"]);
  });

  it("upgrades insecure requests only when the policy is enforced in production", () => {
    const reportOnly = buildContentSecurityPolicy({
      nonce: NONCE,
      mode: "report-only",
      isDev: false,
    });
    const development = buildContentSecurityPolicy({
      nonce: NONCE,
      mode: "enforce",
      isDev: true,
    });

    expect(sourcesOf(production, "upgrade-insecure-requests")).toEqual([]);
    expect(sourcesOf(reportOnly, "upgrade-insecure-requests")).toBeUndefined();
    expect(sourcesOf(development, "upgrade-insecure-requests")).toBeUndefined();
  });

  it.each(["abc'; script-src *", "abc def", "", "abc;"])(
    "refuses the malformed nonce %j, which could inject directives",
    (nonce) => {
      expect(() =>
        buildContentSecurityPolicy({ nonce, mode: "enforce", isDev: false }),
      ).toThrow(/nonce/i);
    },
  );
});

describe("violation reports", () => {
  it("go to the reporting endpoint through report-to, and report-uri as a fallback", () => {
    const policy = buildContentSecurityPolicy({
      nonce: NONCE,
      mode: "enforce",
      isDev: false,
    });

    expect(sourcesOf(policy, "report-to")).toEqual([CSP_REPORT_GROUP]);
    expect(sourcesOf(policy, "report-uri")).toEqual([CSP_REPORT_PATH]);
  });
});

describe("cspHeaderName", () => {
  it("maps each mode to its response header", () => {
    expect(cspHeaderName("enforce")).toBe("Content-Security-Policy");
    expect(cspHeaderName("report-only")).toBe(
      "Content-Security-Policy-Report-Only",
    );
  });

  it("is enforced since the end of P3, before any user input (ADR-0002)", () => {
    expect(CSP_MODE).toBe("enforce");
  });
});
