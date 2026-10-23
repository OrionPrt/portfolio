import { expect, test } from "@playwright/test";

interface ThemeProbe {
  classAtDomReady?: string;
}

test.describe("theme", () => {
  test("applies a saved theme before the first paint, without a flash", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("theme", "dark");
      document.addEventListener("DOMContentLoaded", () => {
        (window as ThemeProbe & Window).classAtDomReady =
          document.documentElement.className;
      });
    });

    await page.goto("/fr");

    const classAtDomReady = await page.evaluate(
      () => (window as ThemeProbe & Window).classAtDomReady,
    );
    expect(classAtDomReady).toContain("dark");
  });

  test("remembers the theme chosen in the switcher", async ({ page }) => {
    await page.goto("/fr");

    await page.locator("label", { hasText: "Sombre" }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await page.reload();

    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(page.getByLabel("Sombre")).toBeChecked();
  });

  test("follows the operating system until the visitor chooses", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/fr");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);

    await page.emulateMedia({ colorScheme: "light" });

    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    await expect(page.getByLabel("Système")).toBeChecked();
  });

  test("hydrates a saved theme without any React hydration error", async ({
    page,
  }) => {
    // Production builds minify hydration errors to React error codes 418, 419, 423 and 425.
    const hydrationProblem =
      /hydrat|did not match|Minified React error #4(18|19|23|25)/i;
    const problems: string[] = [];
    page.on("console", (message) => {
      if (hydrationProblem.test(message.text())) {
        problems.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      if (hydrationProblem.test(error.message)) {
        problems.push(error.message);
      }
    });
    await page.addInitScript(() => {
      localStorage.setItem("theme", "dark");
    });

    await page.goto("/fr");
    await expect(page.getByLabel("Sombre")).toBeChecked();

    expect(problems).toEqual([]);
  });

  // Regression: each locale kept its own theme state, so a choice made in one
  // language was undone when coming back to the other.
  test("keeps the theme chosen in one language when switching back to the other", async ({
    page,
  }) => {
    const html = page.locator("html");
    const switchTo = (label: RegExp) =>
      page.getByRole("navigation").getByRole("link", { name: label }).click();

    await page.goto("/fr");
    await page.locator("label", { hasText: "Sombre" }).click();
    await expect(html).toHaveClass(/\bdark\b/);

    await switchTo(/^EN/);
    await expect(page).toHaveURL(/\/en$/);
    await expect(html).toHaveClass(/\bdark\b/);
    await page.locator("label", { hasText: "Light" }).click();
    await expect(html).not.toHaveClass(/\bdark\b/);

    await switchTo(/^FR/);
    await expect(page).toHaveURL(/\/fr$/);

    await expect(html).not.toHaveClass(/\bdark\b/);
    await expect(page.getByLabel("Clair")).toBeChecked();
    await page.reload();
    await expect(html).not.toHaveClass(/\bdark\b/);
  });

  // Regression: the hidden copy of the other locale shared the radio group name,
  // so the visible switcher lost its selected state right after a change.
  test("keeps showing the selected theme after visiting the other language", async ({
    page,
  }) => {
    await page.goto("/fr");
    await page
      .getByRole("navigation")
      .getByRole("link", { name: /^EN/ })
      .click();
    await expect(page).toHaveURL(/\/en$/);

    await page.locator("label", { hasText: "Dark" }).click();

    await expect(page.getByLabel("Dark")).toBeChecked();
    await page.locator("label", { hasText: "Light" }).click();
    await expect(page.getByLabel("Light")).toBeChecked();
  });
});
