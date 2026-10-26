import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

const LEGACY_REPORT = JSON.stringify({
  "csp-report": {
    "document-uri": "https://orion.dev/fr",
    "effective-directive": "script-src-elem",
    "blocked-uri": "inline",
  },
});

// A fresh module per test: its rate limiters live at module level.
async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

function report(
  body: string,
  contentType = "application/csp-report",
  ip = "203.0.113.7",
): Request {
  return new Request("https://orion.dev/api/csp-report", {
    method: "POST",
    body,
    headers: { "content-type": contentType, "x-forwarded-for": ip },
  });
}

describe("POST /api/csp-report", () => {
  let consoleWarn: MockInstance;

  beforeEach(() => {
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // Behind Vercel's edge, the only place X-Forwarded-For is trusted.
    vi.stubEnv("VERCEL", "1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("logs each violation and answers 204", async () => {
    const { POST } = await loadRoute();

    const response = await POST(report(LEGACY_REPORT));

    expect(response.status).toBe(204);
    expect(String(consoleWarn.mock.calls[0]?.[0])).toContain("csp.violation");
    expect(String(consoleWarn.mock.calls[0]?.[0])).toContain("script-src-elem");
  });

  it("refuses what is not a report, without logging it", async () => {
    const { POST } = await loadRoute();

    expect((await POST(report("{}", "application/json"))).status).toBe(400);
    expect((await POST(report("nope"))).status).toBe(400);
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it("refuses an oversized body", async () => {
    const { POST } = await loadRoute();

    expect((await POST(report("x".repeat(70_000)))).status).toBe(413);
  });

  it("does not let one noisy client use up everyone's budget", async () => {
    const { POST } = await loadRoute();

    for (let attempt = 0; attempt < 700; attempt++) {
      await POST(report(LEGACY_REPORT, undefined, "203.0.113.66"));
    }

    expect(
      (await POST(report(LEGACY_REPORT, undefined, "198.51.100.9"))).status,
    ).toBe(204);
  });

  it("limits how often one client can report", async () => {
    const { POST } = await loadRoute();
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 25; attempt++) {
      statuses.push((await POST(report(LEGACY_REPORT))).status);
    }

    expect(statuses.filter((status) => status === 204)).toHaveLength(20);
    expect(statuses.at(-1)).toBe(429);
    expect(
      (await POST(report(LEGACY_REPORT, undefined, "198.51.100.9"))).status,
    ).toBe(204);
  });
});
