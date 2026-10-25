import { expect, test, type Page } from "@playwright/test";

import { FRENCH_PAGES } from "./support/content";

async function overflowsHorizontally(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
}

// 320 px: the narrowest phone (WCAG 1.4.10 Reflow). 640 px wide is a 1280 px
// screen zoomed to 200 % (WCAG 1.4.4 Resize Text).
const VIEWPORTS = [
  ["375 px", { width: 375, height: 812 }],
  ["320 px", { width: 320, height: 640 }],
  ["200 % zoom", { width: 640, height: 360 }],
] as const;

for (const [label, viewport] of VIEWPORTS) {
  test.describe(`at ${label}`, () => {
    test.use({ viewport });

    for (const [name, path] of FRENCH_PAGES) {
      test(`the ${name} page reflows without horizontal scrolling`, async ({
        page,
      }) => {
        await page.goto(path);

        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await overflowsHorizontally(page)).toBe(false);
      });
    }
  });
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("stacks the hub's tiles in one column", async ({ page }) => {
    await page.goto("/fr");
    const tiles = page.getByRole("main").locator("section");

    const lefts = await tiles.evaluateAll((sections) =>
      sections.map((section) =>
        Math.round(section.getBoundingClientRect().left),
      ),
    );

    expect(lefts.length).toBeGreaterThan(1);
    expect(new Set(lefts).size).toBe(1);
  });
});
