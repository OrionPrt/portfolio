import type { Page } from "@playwright/test";

/**
 * Opens a page and waits for its scripts: a link clicked before hydration does
 * a full page load, without the client navigation (morph, focus) under test.
 */
export async function openHydrated(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}
