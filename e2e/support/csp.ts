import type { Page } from "@playwright/test";

/** Records every CSP violation the page raises, from the first byte of the next navigation. */
export async function collectCspViolations(
  page: Page,
): Promise<readonly string[]> {
  const violations: string[] = [];
  await page.exposeFunction("reportCspViolation", (violation: string) => {
    violations.push(violation);
  });
  await page.addInitScript(() => {
    const report = (
      window as unknown as { reportCspViolation: (violation: string) => void }
    ).reportCspViolation;
    document.addEventListener("securitypolicyviolation", (event) => {
      report(
        `${event.effectiveDirective} ${event.blockedURI} ${event.sourceFile}:${String(event.lineNumber)}`,
      );
    });
  });
  return violations;
}
