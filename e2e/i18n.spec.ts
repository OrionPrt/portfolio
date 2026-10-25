import { expect, test } from "@playwright/test";

import { FEATURED_PROJECT } from "./support/content";

const SLUG = FEATURED_PROJECT.slug;

const languageRedirects = [
  ["a French browser", "fr-FR,fr;q=0.9", "/fr"],
  ["an English browser", "en-GB,en;q=0.9", "/en"],
  ["an unsupported language", "de-DE,de;q=0.9", "/fr"],
] as const;

test.describe("locale routing", () => {
  for (const [label, acceptLanguage, target] of languageRedirects) {
    test(`sends ${label} to ${target}`, async ({ request }) => {
      const response = await request.get("/", {
        headers: { "accept-language": acceptLanguage },
        maxRedirects: 0,
      });

      expect(response.status()).toBe(307);
      expect(
        new URL(response.headers().location ?? "", "http://localhost").pathname,
      ).toBe(target);
    });
  }

  test("keeps the visitor on the same page when switching language", async ({
    page,
  }) => {
    await page.goto(`/fr/projets/${SLUG}`);

    await page
      .getByRole("navigation", { name: "Langue" })
      .getByRole("link", { name: /^EN/ })
      .click();

    await expect(page).toHaveURL(new RegExp(`/en/projects/${SLUG}$`));
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("shows a page under its translated URL", async ({ page }) => {
    await page.goto(`/fr/projects/${SLUG}`);

    await expect(page).toHaveURL(new RegExp(`/fr/projets/${SLUG}$`));
  });

  test("renders a translated not-found page", async ({ page }) => {
    await page.goto("/en/does-not-exist");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Page not found",
    );
  });

  test("treats an unknown locale prefix as a path of the default locale", async ({
    page,
  }) => {
    await page.goto("/de/projets");

    await expect(page).toHaveURL(/\/fr\/de\/projets$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Page introuvable",
    );
  });
});

test.describe("locale preference", () => {
  test.use({ locale: "fr-FR" });

  test("remembers the language chosen with the switcher", async ({ page }) => {
    await page.goto("/fr");
    await page
      .getByRole("navigation", { name: "Langue" })
      .getByRole("link", { name: /^EN/ })
      .click();
    await expect(page).toHaveURL(/\/en$/);

    await page.goto("/");

    await expect(page).toHaveURL(/\/en$/);
  });
});
