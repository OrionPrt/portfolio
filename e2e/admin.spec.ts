import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN_PATTERNS,
  KNOWN_ADMIN_PATHS,
  PUBLIC_ADMIN_PATHS,
} from "../src/features/auth/admin-paths";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  authenticator,
  insertContactMessage,
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

/** Every page that needs a full session, from the proxy's own table. */
const PROTECTED_PAGES = [
  ...[...KNOWN_ADMIN_PATHS].filter((path) => !PUBLIC_ADMIN_PATHS.has(path)),
  ...ADMIN_PATTERNS.map((pattern) =>
    pattern.replace("[id]", "0f8fad5b-d9cb-469f-a165-70867728950e"),
  ),
];

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
  expect(PROTECTED_PAGES).toContain("/admin/messages");
  for (const path of PROTECTED_PAGES) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/admin\/login$/);
  }
  // A password alone opens the second step, nothing more.
  await signInWithPassword(page);
  await expect(page).toHaveURL(/\/admin\/login\/2fa$/);
  for (const path of PROTECTED_PAGES) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/admin\/login$/);
  }
});

test("reads, archives and deletes a message from the inbox", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const subject = `E2E inbox ${String(Date.now())}`;
  await insertContactMessage(subject);
  await signIn(page);

  const nav = page.getByRole("navigation", { name: "Administration" });
  await expect(
    nav.getByRole("link", { name: /^Messages \d+ non lus?$/ }),
  ).toBeVisible();
  await nav.getByRole("link", { name: /^Messages/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Messages");
  // Earlier pages stay mounted, hidden: the frame, and its ids, stay single.
  // Focus moves to the new page, not back to the top of the document.
  await expect(page.locator("#admin-main")).toHaveCount(1);
  await expect(page.locator("#admin-main")).toBeFocused();
  await expectNoAxeViolation(page);
  const row = page.getByRole("link", {
    name: new RegExp(`^Non lu, ${subject}`),
  });
  await row.click();

  const message = page.getByRole("article", { name: subject });
  // Opening it marks it read; the body stays text, never HTML.
  await expect(message.getByText("Lu", { exact: true })).toBeVisible();
  await expect(message.getByText("<b>pas du HTML</b>")).toBeVisible();
  await expect(
    message.getByRole("link", { name: "Répondre par e-mail" }),
  ).toHaveAttribute("href", /^mailto:ada@example\.com\?subject=Re/);
  await expectNoAxeViolation(page);
  await message.getByRole("button", { name: "Archiver" }).click();
  await expect(message.getByRole("status")).toHaveText("Message archivé.");

  await page.goto("/admin/messages?view=archived");
  await page.getByRole("link", { name: new RegExp(`^${subject}`) }).click();
  const trigger = page.getByRole("button", { name: "Supprimer", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: /Supprimer ce message/ });
  await expect(dialog.getByRole("button", { name: "Annuler" })).toBeFocused();
  // Escape closes it, and focus returns to what opened it.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog
    .getByRole("button", { name: "Supprimer définitivement" })
    .click();

  await expect(page).toHaveURL(/\/admin\/messages$/);
  await page.goto("/admin/messages?view=archived");
  await expect(page.getByText(subject)).toHaveCount(0);
});

test("edits the profile, the links and the skills, and the site shows each change", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const stamp = String(Date.now());
  await signIn(page);
  const nav = page.getByRole("navigation", { name: "Administration" });

  // Profile: only the availability, which no other suite reads, then back.
  await nav.getByRole("link", { name: "Profil" }).click();
  // A client navigation: its title and content arrive before axe looks.
  await expect(page).toHaveTitle(/^Profil/);
  await expectNoAxeViolation(page);
  const availability = page
    .getByRole("group", { name: "Disponibilité" })
    .getByLabel("Français");
  const original = await availability.inputValue();
  await availability.fill(`Disponible dès janvier (${stamp})`);
  // Leaving with unsaved changes asks first; dismissed, the page stays.
  page.once("dialog", (dialog) => void dialog.dismiss());
  await nav.getByRole("link", { name: "Liens" }).click();
  await expect(page).toHaveURL(/\/admin\/profile$/);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  // The form's region: the frame's announcer is another one.
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Modifications enregistrées.",
  );
  await page.goto("/fr/a-propos");
  await expect(page.getByText(`(${stamp})`)).toBeVisible();
  await page.goto("/admin/profile");
  await availability.fill(original);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  // The form's region: the frame's announcer is another one.
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Modifications enregistrées.",
  );

  // Links: a kind the seed leaves free, moved up, shown, then deleted.
  await page.goto("/admin/links");
  await expectNoAxeViolation(page);
  const add = page.getByRole("region", { name: "Ajouter un lien" });
  await add.getByLabel("Type").selectOption("website");
  await add.getByLabel("Adresse").fill(`https://example.com/${stamp}`);
  await add.getByRole("button", { name: "Enregistrer" }).click();
  const card = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "Site web" }) });
  await card.getByRole("button", { name: "Monter Site web" }).click();
  await expect(
    card.getByRole("button", { name: "Monter Site web" }),
  ).toBeFocused();
  // Its own row moves this time: the button keeps the focus all the same.
  await card.getByRole("button", { name: "Descendre Site web" }).click();
  await expect(
    card.getByRole("button", { name: "Descendre Site web" }),
  ).toBeFocused();
  await page.goto("/fr/a-propos");
  await expect(
    page.locator(`a[href="https://example.com/${stamp}"]`).first(),
  ).toBeAttached();
  await page.goto("/admin/links");
  await card.getByRole("button", { name: "Supprimer" }).click();
  await page
    .getByRole("dialog", { name: /Supprimer le lien Site web/ })
    .getByRole("button", { name: "Supprimer définitivement" })
    .click();
  await expect(card).toHaveCount(0);

  // Skills: created, shown on the site, renamed, then deleted.
  const name = `Outil E2E ${stamp}`;
  await page.goto("/admin/skills/new");
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("Slug").fill(`outil-e2e-${stamp}`);
  await page.getByLabel("Domaine").selectOption("devops");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/\/admin\/skills$/);
  await expect(page).toHaveTitle(/^Compétences/);
  await expectNoAxeViolation(page);
  const devops = page.getByRole("region", { name: "DevOps" });
  await devops.getByRole("link", { name: `Modifier ${name}` }).click();
  await expect(page).toHaveTitle(/^Modifier une compétence/);
  await expectNoAxeViolation(page);
  // By role: pages visited earlier stay mounted, hidden, with fields of the same name.
  await page.getByRole("textbox", { name: "Nom" }).fill(`${name} bis`);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  // The form's region: the frame's announcer is another one.
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Modifications enregistrées.",
  );
  await page.goto("/fr/competences");
  await expect(page.getByText(`${name} bis`)).toBeVisible();
  await page.goto("/admin/skills");
  await devops.getByRole("link", { name: `Modifier ${name} bis` }).click();
  await expect(page).toHaveTitle(/^Modifier une compétence/);
  await page.getByRole("button", { name: `Supprimer ${name} bis` }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Supprimer définitivement" })
    .click();
  await expect(page).toHaveURL(/\/admin\/skills$/);
  // The visible list: the entry's own page stays mounted, hidden, a while.
  await expect(
    devops.getByRole("link", { name: `Modifier ${name} bis` }),
  ).toHaveCount(0);
});

/** Long enough for the proxy's lists to reload once (a miss, a second after the last load). */
const POLL = { timeout: 20_000, intervals: [1000] };

test("publishes, renames and deletes a project: its old address leads to the new one, then nowhere", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const stamp = String(Date.now());
  const slug = `projet-e2e-${stamp}`;
  const title = `Projet E2E ${stamp}`;
  const french = (field: string) =>
    page.getByRole("group", { name: field }).getByLabel("Français");
  await signIn(page);

  await page.goto("/admin/projects/new");
  await expect(page).toHaveTitle(/^Nouveau projet/);
  await expectNoAxeViolation(page);
  await page.getByLabel("Statut").selectOption("published");
  await page.getByRole("textbox", { name: "Slug" }).fill(slug);
  await french("Titre").fill(title);
  await french("Accroche").fill("Une accroche");
  await french("Contexte").fill("Le contexte");
  await french("Ce que j'ai fait").fill("Ce qui a été fait");
  await french("Résultat").fill("Le résultat");
  // The catalog's first skill, linked.
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/\/admin\/projects\/[0-9a-f-]{36}$/);
  await expect(page).toHaveTitle(/^Modifier un projet/);
  await expectNoAxeViolation(page);
  const edit = page.url();
  /**
   * A page's own answer, without following it. A miss first: the proxy reloads
   * its lists for a slug it does not know, at most once a second.
   */
  const statusOf = async (path: string) => {
    await page.request.get(`/fr/projets/inconnu-${stamp}`);
    const response = await page.request.get(path, { maxRedirects: 0 });
    const location = response.headers().location;
    return {
      status: response.status(),
      location:
        location === undefined
          ? undefined
          : new URL(location, page.url()).pathname,
    };
  };

  // Published a moment ago: the proxy reloads its lists for a slug it does not know.
  await expect(async () => {
    await page.goto(`/fr/projets/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  }).toPass({ timeout: 15_000 });

  await page.goto(edit);
  await page.getByRole("textbox", { name: "Slug" }).fill(`${slug}-bis`);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  // The form's region: the frame's announcer is another one.
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Modifications enregistrées.",
  );
  // The page sends the browser on while the proxy's lists lag behind. Loaded
  // under a second before the rename, they still miss the new slug a moment.
  await expect(async () => {
    await page.goto(`/fr/projets/${slug}`);
    await expect(page).toHaveURL(new RegExp(`/fr/projets/${slug}-bis$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  }).toPass({ timeout: 15_000 });
  // Then the proxy answers 301 itself, once a miss has reloaded its lists.
  await expect
    .poll(() => statusOf(`/fr/projets/${slug}`), POLL)
    .toEqual({ status: 301, location: `/fr/projets/${slug}-bis` });

  await page.goto("/admin/projects");
  await expect(page).toHaveTitle(/^Projets/);
  await expectNoAxeViolation(page);
  await page
    .getByRole("region", { name: "Autres projets" })
    .getByRole("button", { name: `Supprimer ${title}` })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Supprimer définitivement" })
    .click();
  await expect(
    page.getByRole("link", { name: `Modifier ${title}` }),
  ).toHaveCount(0);
  for (const gone of [slug, `${slug}-bis`]) {
    await expect
      .poll(() => statusOf(`/fr/projets/${gone}`), POLL)
      .toEqual({ status: 404, location: undefined });
  }
});

test("adds an experience as the current position, which the site dates up to today", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const stamp = String(Date.now());
  const company = `Entreprise E2E ${stamp}`;
  const french = (field: string) =>
    page.getByRole("group", { name: field }).getByLabel("Français");
  await signIn(page);

  await page.goto("/admin/experiences/new");
  await expect(page).toHaveTitle(/^Nouvelle expérience/);
  await expectNoAxeViolation(page);
  await page.getByRole("textbox", { name: "Slug" }).fill(`exp-e2e-${stamp}`);
  await page
    .getByRole("textbox", { name: "Entreprise", exact: true })
    .fill(company);
  await page.getByLabel("Type de contrat").selectOption("apprenticeship");
  // Missing start: refused on its field, which takes the focus.
  await french("Intitulé du poste").fill("Ingénieur");
  await french("Contexte").fill("Le contexte");
  await french("Ce que j'ai fait").fill("Ce qui a été fait");
  await french("Résultat").fill("Le résultat");
  await page.getByLabel("Début", { exact: true }).evaluate((input) => {
    input.removeAttribute("required");
  });
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByLabel("Début", { exact: true })).toBeFocused();
  await page.getByLabel("Début", { exact: true }).fill("2025-09-01");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveTitle(/^Modifier une expérience/);

  await page.goto("/admin/experiences");
  await expect(page).toHaveTitle(/^Expériences/);
  await expectNoAxeViolation(page);
  const row = page
    .getByRole("listitem")
    .filter({ hasText: `Ingénieur, ${company}` });
  await expect(row).toContainText("septembre 2025 – aujourd'hui");
  await expect(row).toContainText("Brouillon");
  await row.getByRole("button", { name: "Supprimer" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Supprimer définitivement" })
    .click();
  await expect(row).toHaveCount(0);
});

test("revokes the other sessions, renews the recovery codes, and signs out", async ({
  page,
}) => {
  // Three codes, each from a later time step than the last one used (the
  // inbox test's included): up to a minute and a half of waiting.
  test.setTimeout(180_000);
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
  // Rendered per request: never stored by a cache, nor kept for the back button.
  expect(response.headers()["cache-control"]).toContain("no-store");
});
