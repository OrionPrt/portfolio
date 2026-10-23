import { expect, test, type APIResponse, type Page } from "@playwright/test";

// Report-only until the end of P3 (ADR-0002); switch to "content-security-policy" when enforced.
const CSP_HEADER = "content-security-policy-report-only";

function nonceOf(response: APIResponse): string | undefined {
  return /'nonce-([^']+)'/.exec(response.headers()[CSP_HEADER] ?? "")?.[1];
}

function scriptTagsOf(html: string): string[] {
  return html.match(/<script\b[^>]*>/g) ?? [];
}

/** Records every CSP violation the page raises, from the first byte of the next navigation. */
async function collectCspViolations(page: Page): Promise<readonly string[]> {
  const violations: string[] = [];
  await page.exposeFunction("reportCspViolation", (violation: string) => {
    violations.push(violation);
  });
  await page.addInitScript(() => {
    const report = (
      window as unknown as { reportCspViolation: (violation: string) => void }
    ).reportCspViolation;
    document.addEventListener("securitypolicyviolation", (event) => {
      report(`${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
  return violations;
}

test.describe("home page", () => {
  test("renders the placeholder in French", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Portfolio en construction",
    );
  });

  test("is kept out of search engines until launch", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  });
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

  test("raises no CSP violation on a normal visit", async ({ page }) => {
    const violations = await collectCspViolations(page);

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(violations).toEqual([]);
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
