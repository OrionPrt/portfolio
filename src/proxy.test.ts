import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CSP_MODE, cspHeaderName } from "@/lib/csp";

import { config, proxy } from "./proxy";

const CSP_HEADER = cspHeaderName(CSP_MODE);
const OTHER_CSP_HEADER = cspHeaderName(
  CSP_MODE === "enforce" ? "report-only" : "enforce",
);

function handle(path = "/", headers: HeadersInit = {}): Response {
  return proxy(new NextRequest(`https://portfolio.test${path}`, { headers }));
}

function nonceOf(policy: string | null): string | undefined {
  return /'nonce-([^']+)'/.exec(policy ?? "")?.[1];
}

/** NextResponse.next({ request: { headers } }) exposes forwarded request headers as x-middleware-request-*. */
function forwardedHeader(response: Response, name: string): string | null {
  return response.headers.get(`x-middleware-request-${name.toLowerCase()}`);
}

describe("proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("attaches a CSP carrying a nonce to the response", () => {
    const policy = handle().headers.get(CSP_HEADER);

    expect(nonceOf(policy)).toBeDefined();
  });

  it("uses a fresh nonce for every request", () => {
    const first = nonceOf(handle().headers.get(CSP_HEADER));
    const second = nonceOf(handle().headers.get(CSP_HEADER));

    expect(first).not.toBe(second);
  });

  it("forwards the policy and nonce to the renderer so Next.js can sign its scripts", () => {
    const response = handle();
    const policy = response.headers.get(CSP_HEADER);

    expect(forwardedHeader(response, CSP_HEADER)).toBe(policy);
    expect(forwardedHeader(response, "x-nonce")).toBe(nonceOf(policy));
  });

  it("drops a client-supplied policy header, which Next.js would read instead of ours", () => {
    const response = handle("/", {
      [OTHER_CSP_HEADER]: "default-src *",
      [CSP_HEADER]: "default-src *",
    });

    expect(forwardedHeader(response, OTHER_CSP_HEADER)).toBeNull();
    expect(forwardedHeader(response, CSP_HEADER)).toBe(
      response.headers.get(CSP_HEADER),
    );
  });

  it("only allows eval in development", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(handle().headers.get(CSP_HEADER)).toContain("'unsafe-eval'");
  });
});

describe("proxy matcher", () => {
  it.each([
    "/",
    "/fr",
    "/fr/projets/demo",
    "/admin/login",
    "/api/cron/daily",
    // Fail closed: an extension never exempts a path, it could be a page.
    "/fr/projets/demo.svg",
    "/nonexistent.xml",
    "/images/hero.webp",
  ])("protects %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  it.each([
    "/_next/static/chunks/main.js",
    "/_next/image?url=%2Fhero.png&w=640&q=75",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
  ])("skips the build asset or exact static file %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });

  it("protects documents prefetched by the browser (Purpose: prefetch)", () => {
    const prefetch = unstable_doesMiddlewareMatch({
      config,
      url: "/fr",
      headers: { purpose: "prefetch" },
    });

    expect(prefetch).toBe(true);
  });

  it("skips in-app router prefetches, which return flight data rather than HTML", () => {
    const prefetch = unstable_doesMiddlewareMatch({
      config,
      url: "/fr",
      headers: { "next-router-prefetch": "1" },
    });

    expect(prefetch).toBe(false);
  });
});
