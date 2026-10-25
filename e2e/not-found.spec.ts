import { expect, test } from "@playwright/test";

import { FEATURED_PROJECT, FRENCH_PAGES } from "./support/content";

// Under Cache Components a rendered page streams with status 200 before it
// could call notFound(): the proxy answers 404 itself (ADR-0003).
const MISSING = [
  ["an unknown path", "/fr/inconnu", "fr", "Page introuvable"],
  ["an unknown project", "/fr/projets/inconnu", "fr", "Page introuvable"],
  ["a malformed slug", "/fr/projets/Inconnu", "fr", "Page introuvable"],
  ["an unknown experience", "/en/experiences/ghost", "en", "Page not found"],
  ["an unknown English path", "/en/does-not-exist", "en", "Page not found"],
] as const;

test.describe("real 404s", () => {
  for (const [label, path, locale, title] of MISSING) {
    test(`answers 404 for ${label}`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(404);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex",
      );
      await expect(
        page.getByRole("link", { name: /accueil|home/i }),
      ).toHaveAttribute("href", `/${locale}`);
    });
  }

  for (const [name, path] of FRENCH_PAGES) {
    test(`answers 200 for the ${name} page`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(200);
    });
  }

  test("answers 200 for a published project in English", async ({
    request,
  }) => {
    const response = await request.get(`/en/projects/${FEATURED_PROJECT.slug}`);

    expect(response.status()).toBe(200);
  });
});
