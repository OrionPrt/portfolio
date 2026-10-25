import { expect, test, type APIResponse } from "@playwright/test";

import { FEATURED_PROJECT, FRENCH_PAGES } from "./support/content";
import { collectCspViolations } from "./support/csp";

// Enforced since the end of P3 (ADR-0002).
const CSP_HEADER = "content-security-policy";

function nonceOf(response: APIResponse): string | undefined {
  return /'nonce-([^']+)'/.exec(response.headers()[CSP_HEADER] ?? "")?.[1];
}

/** Executable scripts only: JSON-LD is a data block, never run, so CSP leaves it alone. */
function scriptTagsOf(html: string): string[] {
  return (html.match(/<script\b[^>]*>/g) ?? []).filter(
    (tag) => !tag.includes('type="application/ld+json"'),
  );
}

test.describe("home page", () => {
  test("renders the home page in French by default", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Orion");
  });

  test("is kept out of search engines until launch", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  });
});

test.describe("paths outside the locale tree", () => {
  for (const path of ["/api/csp-report", "/.well-known/security.txt"]) {
    test(`never redirects ${path} to a locale`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.headers().location).toBeUndefined();
      expect(response.headers()[CSP_HEADER]).toBeDefined();
    });
  }
});

test.describe("security", () => {
  test("ships the hardened security headers", async ({ request }) => {
    const headers = (await request.get("/")).headers();

    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  // A shared cache replaying a page would replay its nonce, and void the CSP.
  test("keeps rendered pages out of shared caches", async ({ request }) => {
    for (const path of [
      "/fr",
      `/fr/projets/${FEATURED_PROJECT.slug}`,
      "/fr/inconnu",
    ]) {
      const cacheControl =
        (await request.get(path)).headers()["cache-control"] ?? "";

      expect(cacheControl, path).toContain("private");
      expect(cacheControl, path).toContain("no-store");
    }
  });

  test("signs every script with a nonce that changes on each request", async ({
    request,
  }) => {
    const first = await request.get("/");
    const second = await request.get("/");
    const nonce = nonceOf(first);

    expect(nonce).toBeTruthy();
    expect(nonceOf(second)).not.toBe(nonce);

    const scriptTags = scriptTagsOf(await first.text());
    expect(scriptTags.length).toBeGreaterThan(0);
    for (const tag of scriptTags) {
      expect(tag).toContain(`nonce="${nonce ?? ""}"`);
    }
  });

  test("raises no CSP violation on a visit through every page", async ({
    page,
  }) => {
    const violations = await collectCspViolations(page);

    // Turnstile keeps the contact page's network busy: contact.spec.ts covers it.
    const pages = FRENCH_PAGES.filter(([name]) => name !== "contact");
    for (const [, path] of [...pages, ["not found", "/fr/inconnu"]]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }

    expect(violations).toEqual([]);
  });

  test("names its reporting endpoint, which accepts violation reports", async ({
    request,
  }) => {
    const page = await request.get("/fr");
    const policy = page.headers()[CSP_HEADER] ?? "";

    expect(policy).toContain("report-to csp-endpoint");
    expect(page.headers()["reporting-endpoints"]).toBe(
      'csp-endpoint="/api/csp-report"',
    );

    const report = await request.post("/api/csp-report", {
      headers: { "content-type": "application/csp-report" },
      data: JSON.stringify({
        "csp-report": {
          "document-uri": "http://localhost/fr",
          "effective-directive": "script-src-elem",
          "blocked-uri": "inline",
        },
      }),
    });
    expect(report.status()).toBe(204);
  });

  test("flags an injected inline event handler, the classic XSS vector", async ({
    page,
  }) => {
    const violations = await collectCspViolations(page);
    await page.goto("/");

    // Chrome exempts code evaluated through DevTools from CSP, so the payload
    // must run from a browser-fired event, exactly like a stored XSS would.
    await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        '<img src="/does-not-exist.png" alt="" onerror="void 0">',
      );
    });

    await expect.poll(() => violations.length).toBeGreaterThan(0);
    expect(violations[0]).toMatch(/^script-src-attr /);
  });

  test("keeps signing scripts when the request carries a forged CSP header", async ({
    request,
  }) => {
    const response = await request.get("/", {
      headers: { "Content-Security-Policy": "default-src *" },
    });
    const nonce = nonceOf(response);

    expect(nonce).toBeTruthy();
    for (const tag of scriptTagsOf(await response.text())) {
      expect(tag).toContain(`nonce="${nonce ?? ""}"`);
    }
  });

  const uncommonRequests = [
    ["documents prefetched by the browser", "/", { Purpose: "prefetch" }],
    ["paths ending with a file extension", "/fr/projets/demo.svg", {}],
  ] as const;

  for (const [label, path, headers] of uncommonRequests) {
    test(`protects ${label}`, async ({ request }) => {
      const response = await request.get(path, { headers });

      expect(nonceOf(response)).toBeTruthy();
    });
  }
});
