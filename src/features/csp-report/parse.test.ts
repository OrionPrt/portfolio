import { describe, expect, it } from "vitest";

import { MAX_FIELD_LENGTH, parseCspReports } from "./parse";

const LEGACY = {
  "csp-report": {
    "document-uri": "https://orion.dev/fr/projets?token=secret#x",
    "violated-directive": "script-src-elem",
    "effective-directive": "script-src-elem",
    "blocked-uri": "https://evil.example/x.js?k=1",
    disposition: "enforce",
    "source-file": "https://orion.dev/_next/static/chunks/a.js",
    "line-number": 3,
    "column-number": 14,
    "script-sample": "alert(1)",
  },
};

const REPORTING_API = [
  {
    type: "csp-violation",
    age: 10,
    url: "https://orion.dev/en",
    body: {
      documentURL: "https://orion.dev/en",
      blockedURL: "inline",
      effectiveDirective: "script-src-elem",
      disposition: "enforce",
      lineNumber: 1,
    },
  },
  { type: "deprecation", body: { id: "x" } },
];

describe("parseCspReports", () => {
  it("reads a legacy report-uri report, keeping URLs without query or fragment", () => {
    expect(
      parseCspReports("application/csp-report", JSON.stringify(LEGACY)),
    ).toEqual([
      {
        documentUrl: "https://orion.dev/fr/projets",
        blockedUrl: "https://evil.example/x.js",
        directive: "script-src-elem",
        disposition: "enforce",
        sourceFile: "https://orion.dev/_next/static/chunks/a.js",
        line: 3,
        column: 14,
        sample: "alert(1)",
      },
    ]);
  });

  it("reads the CSP violations of a Reporting API batch and skips other reports", () => {
    expect(
      parseCspReports(
        "application/reports+json",
        JSON.stringify(REPORTING_API),
      ),
    ).toEqual([
      {
        documentUrl: "https://orion.dev/en",
        blockedUrl: "inline",
        directive: "script-src-elem",
        disposition: "enforce",
        sourceFile: null,
        line: 1,
        column: null,
        sample: null,
      },
    ]);
  });

  it("accepts the null fields browsers send, and skips only a malformed member", () => {
    const batch = [
      {
        type: "csp-violation",
        body: {
          documentURL: "https://orion.dev/fr",
          blockedURL: "eval",
          effectiveDirective: "script-src",
          sourceFile: null,
          lineNumber: null,
          columnNumber: null,
          sample: null,
        },
      },
      { type: "csp-violation", body: { lineNumber: "not a number" } },
    ];

    expect(
      parseCspReports("application/reports+json", JSON.stringify(batch)),
    ).toEqual([
      {
        documentUrl: "https://orion.dev/fr",
        blockedUrl: "eval",
        directive: "script-src",
        disposition: null,
        sourceFile: null,
        line: null,
        column: null,
        sample: null,
      },
    ]);
  });

  it("keeps the scheme and host of URLs with an opaque origin", () => {
    const report = {
      "csp-report": {
        ...LEGACY["csp-report"],
        "blocked-uri": "chrome-extension://abcdef/inject.js?x=1",
      },
    };

    const reports = parseCspReports(
      "application/csp-report",
      JSON.stringify(report),
    );

    expect(reports?.[0]?.blockedUrl).toBe(
      "chrome-extension://abcdef/inject.js",
    );
  });

  it("truncates long fields, so a report cannot flood the logs", () => {
    const long = {
      "csp-report": {
        ...LEGACY["csp-report"],
        "script-sample": "a".repeat(5000),
      },
    };

    const reports = parseCspReports(
      "application/csp-report",
      JSON.stringify(long),
    );

    expect(reports?.[0]?.sample).toHaveLength(MAX_FIELD_LENGTH);
  });

  it.each([
    ["not JSON", "application/csp-report", "{"],
    ["the wrong shape", "application/csp-report", '{"x":1}'],
    [
      "a batch too large",
      "application/reports+json",
      JSON.stringify(Array(51).fill(REPORTING_API[0])),
    ],
    ["an unknown media type", "text/plain", JSON.stringify(LEGACY)],
  ])("rejects %s", (_label, contentType, body) => {
    expect(parseCspReports(contentType, body)).toBeUndefined();
  });
});
