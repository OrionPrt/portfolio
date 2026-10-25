import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { FEATURED_PROJECT, FRENCH_PAGES } from "./support/content";
import { openHydrated } from "./support/navigation";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const pages = [
  ...FRENCH_PAGES,
  ["about, in English", "/en/about"],
  ["not found", "/en/does-not-exist"],
] as const;

const schemes = ["light", "dark"] as const;

test.describe("accessibility", () => {
  for (const [name, path] of pages) {
    for (const colorScheme of schemes) {
      test(`${name} page has no detectable WCAG 2.2 AA violation (${colorScheme})`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(path);

        const results = await new AxeBuilder({ page })
          .withTags(WCAG_TAGS)
          .analyze();

        expect(
          results.violations.map(
            (violation) => `${violation.id} (${violation.nodes.length})`,
          ),
        ).toEqual([]);
      });
    }
  }

  test("offers a skip link as the first focusable element", async ({
    page,
  }) => {
    await page.goto("/fr");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Aller au contenu" });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("main")).toBeFocused();
  });

  // Regression: Cache Components keeps the other locale's page mounted (hidden),
  // so fixed ids were duplicated and the skip link targeted the hidden copy.
  test("keeps ids unique and the skip link working after a language switch", async ({
    page,
  }) => {
    await page.goto("/fr");
    await page
      .getByRole("navigation")
      .getByRole("link", { name: /^EN/ })
      .click();
    await expect(page).toHaveURL(/\/en$/);

    const duplicateIds = await page.evaluate(() => {
      const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    });
    expect(duplicateIds).toEqual([]);

    await page.getByRole("link", { name: "Skip to content" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
  });
});

// Next.js leaves focus untouched on client navigations, and the link that had it
// now sits in a hidden tree: focus moves to the new page's main region instead.
test.describe("focus after navigation", () => {
  test("lands on the new page's main region when a tile opens its view", async ({
    page,
  }) => {
    await openHydrated(page, "/fr");

    await page.getByRole("link", { name: FEATURED_PROJECT.title.fr }).focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(
      new RegExp(`/fr/projets/${FEATURED_PROJECT.slug}$`),
    );
    await expect(page.locator("#main-fr")).toBeFocused();
  });

  test("lands on the skill a badge points to", async ({ page }) => {
    const skill = FEATURED_PROJECT.firstSkill;
    test.skip(skill === undefined, "The featured project lists no skill.");
    await openHydrated(page, `/fr/projets/${FEATURED_PROJECT.slug}`);

    await page
      .getByRole("region", { name: "Technologies" })
      .getByRole("link")
      .first()
      .focus();
    await page.keyboard.press("Enter");

    await expect(page.locator(`#skill-${skill ?? ""}-fr`)).toBeFocused();
  });
});
