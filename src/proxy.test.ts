import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CSP_MODE, cspHeaderName } from "@/lib/csp";

import { config, proxy } from "./proxy";

const ORIGIN = "https://portfolio.test";
const CSP_HEADER = cspHeaderName(CSP_MODE);
const OTHER_CSP_HEADER = cspHeaderName(
  CSP_MODE === "enforce" ? "report-only" : "enforce",
);

function handle(path = "/fr", headers: HeadersInit = {}): Response {
  return proxy(new NextRequest(`${ORIGIN}${path}`, { headers }));
}

function nonceOf(policy: string | null): string | undefined {
  return /'nonce-([^']+)'/.exec(policy ?? "")?.[1];
}

/** NextResponse.next/rewrite({ request: { headers } }) expose forwarded request headers as x-middleware-request-*. */
function forwardedHeader(response: Response, name: string): string | null {
  return response.headers.get(`x-middleware-request-${name.toLowerCase()}`);
}

describe("proxy — content security policy", () => {
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

  it("keeps forwarding them when a localized path is rewritten", () => {
    const response = handle("/fr/projets/demo");
    const policy = response.headers.get(CSP_HEADER);

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      `${ORIGIN}/fr/projects/demo`,
    );
    expect(forwardedHeader(response, CSP_HEADER)).toBe(policy);
    expect(forwardedHeader(response, "x-nonce")).toBe(nonceOf(policy));
  });

  it("drops a client-supplied policy header, which Next.js would read instead of ours", () => {
    const response = handle("/fr", {
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

describe("proxy — locale routing", () => {
  it.each([
    ["no preference", {}, "/fr"],
    ["an English browser", { "accept-language": "en-GB,en;q=0.9" }, "/en"],
    [
      "a French browser",
      { "accept-language": "fr-FR,fr;q=0.9,en;q=0.8" },
      "/fr",
    ],
    [
      "a saved English preference",
      { cookie: "NEXT_LOCALE=en", "accept-language": "fr" },
      "/en",
    ],
  ])("redirects / for %s", (_label, headers, target) => {
    const response = handle("/", headers);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${ORIGIN}${target}`);
  });

  it("serves an English URL that already matches its internal route without rewriting", () => {
    const response = handle("/en/projects/demo");

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("redirects a French page requested with its English slug", () => {
    const response = handle("/fr/projects/demo");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/fr/projets/demo`);
  });
});

describe("proxy — paths outside the locale tree", () => {
  it.each([
    "/api/csp-report",
    "/.well-known/security.txt",
    "/_vercel/insights/script.js",
    "/assets/hero.webp",
  ])("serves %s under the CSP without redirecting it to a locale", (path) => {
    const response = handle(path);
    const policy = response.headers.get(CSP_HEADER);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(forwardedHeader(response, "x-nonce")).toBe(nonceOf(policy));
  });
});

describe("proxy — fail closed", () => {
  it("rejects a path that cannot be decoded, before any routing", () => {
    const response = handle("/fr/%E0%A4%A");

    expect(response.status).toBe(400);
    expect(response.headers.get(CSP_HEADER)).not.toBeNull();
  });

  it.each(["TRACE", "PUT", "DELETE", "OPTIONS"])(
    "rejects the %s method with 405",
    (method) => {
      // Fetch refuses to build some of these requests, so the method is overridden.
      const request = Object.defineProperty(
        new NextRequest(`${ORIGIN}/fr`),
        "method",
        { value: method },
      );

      const response = proxy(request);

      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD, POST");
      expect(response.headers.get(CSP_HEADER)).not.toBeNull();
    },
  );
});

describe("proxy — locale redirects and cookie", () => {
  it("keeps the language redirect out of shared caches", () => {
    const response = handle("/", { "accept-language": "en" });

    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toContain("Accept-Language");
    expect(response.headers.get("vary")).toContain("Cookie");
  });

  it("remembers the language for a year in a Secure cookie", () => {
    const cookie = handle("/en").headers.get("set-cookie") ?? "";

    expect(cookie).toContain("NEXT_LOCALE=en");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).toContain("Secure");
  });

  it("does not build hreflang links from client-supplied host headers", () => {
    const response = handle("/fr", { "x-forwarded-host": "evil.example" });

    expect(response.headers.get("link")).toBeNull();
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

  it("runs on in-app router prefetches, so their localized pathnames get rewritten", () => {
    const prefetch = unstable_doesMiddlewareMatch({
      config,
      url: "/fr/projets/demo",
      headers: { "next-router-prefetch": "1" },
    });

    expect(prefetch).toBe(true);
  });
});
