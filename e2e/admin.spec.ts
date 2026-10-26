import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  authenticator,
  resetAdmin,
} from "./support/admin";
import { collectCspViolations } from "./support/csp";

// One account, one story: the tests run in order and share its second factor.
test.describe.configure({ mode: "serial" });

test.skip(
  Boolean(process.env.E2E_BASE_URL),
  "Writes accounts on the site under test",
);

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const nextCode = authenticator();
let recoveryCodes: readonly string[] = [];
const REFUSED = "Code incorrect ou déjà utilisé.";

async function signInWithPassword(
  page: Page,
  email = ADMIN_EMAIL,
  password = ADMIN_PASSWORD,
) {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continuer" }).click();
}

async function expectNoAxeViolation(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
}

async function signIn(page: Page) {
  await signInWithPassword(page);
  await page.getByLabel("Code à 6 chiffres").fill(await nextCode());
  await page.getByRole("button", { name: "Vérifier" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.beforeAll(async () => {
  recoveryCodes = await resetAdmin();
});

test("signs in with the password, then the authenticator's code", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const violations = await collectCspViolations(page);
  await page.goto("/admin/login");
  await expectNoAxeViolation(page);
  await signInWithPassword(page);
  await expect(page).toHaveURL(/\/admin\/login\/2fa$/);
  await expectNoAxeViolation(page);

  await page.getByLabel("Code à 6 chiffres").fill(await nextCode());
  await page.getByRole("button", { name: "Vérifier" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Tableau de bord",
  );
  expect(violations).toEqual([]);
});

test("refuses a wrong code, and stays on the second step", async ({ page }) => {
  await signInWithPassword(page);
  await page.getByLabel("Code à 6 chiffres").fill("000 000");
  await page.getByRole("button", { name: "Vérifier" }).click();

  await expect(page.locator("form").getByRole("alert")).toHaveText(
    new RegExp(REFUSED),
  );
  await expect(page).toHaveURL(/\/admin\/login\/2fa$/);
});

test("signs in with a recovery code, once", async ({ page }) => {
  const [code = ""] = recoveryCodes;
  await signInWithPassword(page);
  await page
    .getByRole("button", { name: "Utiliser un code de récupération" })
    .click();
  await page.getByLabel("Code de récupération").fill(code);
  await page.getByRole("button", { name: "Vérifier" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.context().clearCookies();
  await signInWithPassword(page);
  await page
    .getByRole("button", { name: "Utiliser un code de récupération" })
    .click();
  await page.getByLabel("Code de récupération").fill(code);
  await page.getByRole("button", { name: "Vérifier" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    new RegExp(REFUSED),
  );
});

test("keeps every admin page behind a full session", async ({ page }) => {
  for (const path of ["/admin", "/admin/security"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login$/);
  }
  // A password alone opens the second step, nothing more.
  await signInWithPassword(page);
  await expect(page).toHaveURL(/\/admin\/login\/2fa$/);
  for (const path of ["/admin", "/admin/security"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login$/);
  }
});

test("revokes the other sessions, renews the recovery codes, and signs out", async ({
  page,
}) => {
  // Three codes, each from a later time step: up to a minute of waiting.
  test.setTimeout(120_000);
  await signIn(page);
  await page
    .getByRole("navigation", { name: "Administration" })
    .getByRole("link", { name: "Sécurité" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sécurité");
  await expectNoAxeViolation(page);

  // The earlier tests left their sessions open.
  const sessions = page.getByRole("group", { name: "Sessions à révoquer" });
  await expect(sessions.getByRole("checkbox")).not.toHaveCount(1);
  const revocation = page.getByRole("region", { name: "Sessions actives" });
  await revocation.getByLabel(/^Code à 6 chiffres/).fill(await nextCode());
  await revocation
    .getByRole("button", { name: "Révoquer toutes les autres sessions" })
    .click();
  await expect(revocation.getByRole("status")).toHaveText(
    /\d+ sessions? révoquées?\./,
  );
  await expect(sessions.getByRole("checkbox")).toHaveCount(1);
  await expect(
    sessions.getByRole("checkbox", { name: /cette session/ }),
  ).toBeVisible();

  // Full re-authentication: the password and a TOTP code (ASVS 7.5.1).
  const recovery = page.getByRole("region", { name: "Codes de récupération" });
  await recovery.getByLabel("Votre mot de passe").fill(ADMIN_PASSWORD);
  await recovery.getByLabel(/^Code à 6 chiffres/).fill(await nextCode());
  await recovery
    .getByRole("button", { name: "Générer de nouveaux codes" })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Nouveaux codes de récupération" })
      .getByRole("listitem"),
  ).toHaveCount(10);

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("locks an account from this network after repeated failures", async ({
  page,
}) => {
  for (let attempt = 1; attempt <= 5; attempt++) {
    await signInWithPassword(
      page,
      "intruder@example.com",
      "not the password, again",
    );
  }
  await expect(page.getByText(/Trop de tentatives/)).toBeVisible();
});

test("is never indexed", async ({ request }) => {
  const response = await request.get("/admin/login");

  expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
});
