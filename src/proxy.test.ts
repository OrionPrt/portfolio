import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CSP_MODE, cspHeaderName } from "@/lib/csp";
import { ok } from "@/lib/result";

import { config, proxy } from "./proxy";

// The 404 check reads published slugs from the database: here, a fixed list.
vi.mock("@/features/content/published-slugs", () => ({
  loadPublishedSlugs: () =>
    Promise.resolve(ok({ projects: ["demo"], experiences: ["acme"] })),
}));

const ORIGIN = "https://portfolio.test";
const CSP_HEADER = cspHeaderName(CSP_MODE);
const OTHER_CSP_HEADER = cspHeaderName(
  CSP_MODE === "enforce" ? "report-only" : "enforce",
);

function handle(path = "/fr", headers: HeadersInit = {}): Promise<Response> {
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

  it("attaches a CSP carrying a nonce to the response", async () => {
    const policy = (await handle()).headers.get(CSP_HEADER);

    expect(nonceOf(policy)).toBeDefined();
  });

  it("uses a fresh nonce for every request", async () => {
    const first = nonceOf((await handle()).headers.get(CSP_HEADER));
    const second = nonceOf((await handle()).headers.get(CSP_HEADER));

    expect(first).not.toBe(second);
  });

  it("forwards the policy and nonce to the renderer so Next.js can sign its scripts", async () => {
    const response = await handle();
    const policy = response.headers.get(CSP_HEADER);

    expect(forwardedHeader(response, CSP_HEADER)).toBe(policy);
    expect(forwardedHeader(response, "x-nonce")).toBe(nonceOf(policy));
  });

  it("keeps forwarding them when a localized path is rewritten", async () => {
    const response = await handle("/fr/projets/demo");
    const policy = response.headers.get(CSP_HEADER);

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      `${ORIGIN}/fr/projects/demo`,
    );
    expect(forwardedHeader(response, CSP_HEADER)).toBe(policy);
    expect(forwardedHeader(response, "x-nonce")).toBe(nonceOf(policy));
  });

  it("drops a client-supplied policy header, which Next.js would read instead of ours", async () => {
    const response = await handle("/fr", {
      [OTHER_CSP_HEADER]: "default-src *",
      [CSP_HEADER]: "default-src *",
    });

    expect(forwardedHeader(response, OTHER_CSP_HEADER)).toBeNull();
    expect(forwardedHeader(response, CSP_HEADER)).toBe(
      response.headers.get(CSP_HEADER),
    );
  });

  it("only allows eval in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    expect((await handle()).headers.get(CSP_HEADER)).toContain("'unsafe-eval'");
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
  ])("redirects / for %s", async (_label, headers, target) => {
    const response = await handle("/", headers);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${ORIGIN}${target}`);
  });

  it("serves an English URL that already matches its internal route without rewriting", async () => {
    const response = await handle("/en/projects/demo");

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("redirects a French page requested with its English slug", async () => {
    const response = await handle("/fr/projects/demo");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/fr/projets/demo`);
  });
});

describe("proxy — paths outside the locale tree", () => {
  it.each([
    "/api/csp-report",
    "/_vercel/insights/script.js",
    "/assets/hero.webp",
  ])(
    "serves %s under the CSP without redirecting it to a locale",
    async (path) => {
      const response = await handle(path);
      const policy = response.headers.get(CSP_HEADER);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(forwardedHeader(response, "x-nonce")).toBe(nonceOf(policy));
    },
  );

  // Next.js's own not-found page for these paths ships scripts without a nonce.
  it.each(["/api/nothing", "/.well-known/security.txt"])(
    "answers 404 for %s, which no route handles",
    async (path) => {
      const response = await handle(path);

      expect(response.status).toBe(404);
      expect(await response.text()).toContain('<html lang="fr">');
      expect(response.headers.get(CSP_HEADER)).not.toBeNull();
    },
  );
});

describe("proxy — real 404s", () => {
  it.each([
    ["a path no page claims", "/fr/inconnu", "fr"],
    ["an unpublished project", "/fr/projets/ghost", "fr"],
    ["a malformed slug", "/en/projects/Demo", "en"],
    ["an unpublished experience", "/en/experiences/ghost", "en"],
  ])(
    "answers 404 for %s, with the localized not-found page",
    async (_label, path, locale) => {
      const response = await handle(path);

      expect(response.status).toBe(404);
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.text()).toContain(`<html lang="${locale}">`);
      expect(response.headers.get(CSP_HEADER)).not.toBeNull();
    },
  );

  it.each([
    ["/fr/projets/demo", `${ORIGIN}/fr/projects/demo`],
    ["/en/experiences/acme", null],
  ])("lets the published entry %s through", async (path, rewrite) => {
    const response = await handle(path);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBe(rewrite);
  });
});

describe("proxy — fail closed", () => {
  it("rejects a path that cannot be decoded, before any routing", async () => {
    const response = await handle("/fr/%E0%A4%A");

    expect(response.status).toBe(400);
    expect(response.headers.get(CSP_HEADER)).not.toBeNull();
  });

  it.each(["TRACE", "PUT", "DELETE", "OPTIONS"])(
    "rejects the %s method with 405",
    async (method) => {
      // Fetch refuses to build some of these requests, so the method is overridden.
      const request = Object.defineProperty(
        new NextRequest(`${ORIGIN}/fr`),
        "method",
        { value: method },
      );

      const response = await proxy(request);

      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD, POST");
      expect(response.headers.get(CSP_HEADER)).not.toBeNull();
    },
  );
});

describe("proxy — locale redirects and cookie", () => {
  it("keeps the language redirect out of shared caches", async () => {
    const response = await handle("/", { "accept-language": "en" });

    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toContain("Accept-Language");
    expect(response.headers.get("vary")).toContain("Cookie");
  });

  it("remembers the language for a year in a Secure cookie", async () => {
    const cookie = (await handle("/en")).headers.get("set-cookie") ?? "";

    expect(cookie).toContain("NEXT_LOCALE=en");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).toContain("Secure");
  });

  it("does not build hreflang links from client-supplied host headers", async () => {
    const response = await handle("/fr", {
      "x-forwarded-host": "evil.example",
    });

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

describe("proxy — admin", () => {
  const SESSION = { cookie: `__Host-session=${"a".repeat(52)}` };

  it.each(["/admin/login", "/admin/login/2fa"])(
    "serves %s without a session, outside the locale routing",
    async (path) => {
      const response = await handle(path);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      expect(forwardedHeader(response, "x-nonce")).toBe(
        nonceOf(response.headers.get(CSP_HEADER)),
      );
    },
  );

  it.each([
    "/admin",
    "/admin/security",
    "/admin/messages/0f8fad5b-d9cb-469f-a165-70867728950e",
  ])(
    "sends %s to the login without a session cookie, uncached",
    async (path) => {
      const response = await handle(path);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(`${ORIGIN}/admin/login`);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    },
  );

  it("lets a request with a session cookie through: the page checks it", async () => {
    const response = await handle("/admin/security", SESSION);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  // The web enrollment page is gone: the CLI enrolls the second factor.
  it.each([
    "/admin/unknown",
    "/admin/login/setup",
    "/admin/login/other",
    "/admin/security/x",
    "/admin/messages/not-an-id",
  ])("answers 404 for %s, which no admin page claims", async (path) => {
    const response = await handle(path, SESSION);

    expect(response.status).toBe(404);
    expect(await response.text()).toContain('<html lang="fr">');
  });
});
