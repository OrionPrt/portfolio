import { expect, test, type Page } from "@playwright/test";

import { isLocalDatabase } from "../src/db/local";
import { HONEYPOT_FIELD } from "../src/features/contact/form-state";
import { collectCspViolations } from "./support/csp";
import { countContactMessages } from "./support/database";

// These tests store messages: never against a deployed site. The server runs
// with Cloudflare's test keys, whose widget always passes, and sends no email.
test.skip(
  Boolean(process.env.E2E_BASE_URL),
  "Sends messages to the site under test",
);

test.beforeAll(() => {
  // The server reads the same DATABASE_URL: never a remote (real) database.
  if (!isLocalDatabase(process.env.DATABASE_URL ?? "")) {
    throw new Error(
      "The contact tests write messages: run them with a local DATABASE_URL.",
    );
  }
});

/** Unique per test and run, so storage checks only see their own message. */
function uniqueSubject(label: string): string {
  return `E2E ${label} ${String(Date.now())}-${String(Math.random()).slice(2, 8)}`;
}

async function fill(page: Page, subject: string, name = "Ada Lovelace") {
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByLabel("E-mail", { exact: true }).fill("ada@example.com");
  await page.getByLabel("Objet", { exact: true }).fill(subject);
  await page
    .getByLabel("Message", { exact: true })
    .fill("Bonjour, j'aimerais vous parler d'une mission.");
}

function formOf(page: Page) {
  return page.getByRole("form", { name: "Écrire un message" });
}

/**
 * Opens the page once the widget has issued its token, which enables the
 * button. Not "networkidle": Turnstile keeps the network busy.
 */
async function openReady(page: Page) {
  await page.goto("/fr/contact");
  await expect(page.getByRole("button", { name: "Envoyer" })).toBeEnabled({
    timeout: 20_000,
  });
}

async function send(page: Page) {
  await page.getByRole("button", { name: "Envoyer" }).click();
}

test.describe("contact form", () => {
  test("stores a message sent once Turnstile has passed", async ({ page }) => {
    const violations = await collectCspViolations(page);
    const subject = uniqueSubject("sent");
    await openReady(page);

    await fill(page, subject);
    await send(page);

    await expect(formOf(page).getByRole("status")).toHaveText(/Message envoyé/);
    await expect(page.getByLabel("Objet", { exact: true })).toHaveValue("");
    expect(await countContactMessages(subject)).toBe(1);
    // Cloudflare's script and iframe run under the enforced policy.
    expect(violations).toEqual([]);
  });

  test("refuses a post without a Turnstile token, as a script would send", async ({
    page,
  }) => {
    const subject = uniqueSubject("robot");
    await openReady(page);

    await fill(page, subject);
    await page
      .locator('input[name="cf-turnstile-response"]')
      .evaluate((field: HTMLInputElement) => {
        field.value = "";
      });
    await send(page);

    await expect(formOf(page).getByRole("alert")).toHaveText(
      /La vérification anti-robot a échoué/,
    );
    expect(await countContactMessages(subject)).toBe(0);
  });

  test("points to email when the anti-bot check cannot load", async ({
    page,
  }) => {
    await page.route("https://challenges.cloudflare.com/**", (route) =>
      route.abort(),
    );
    await page.goto("/fr/contact");

    await expect(formOf(page).getByRole("alert")).toHaveText(
      /La vérification anti-robot n'a pas pu se charger/,
    );
    await expect(page.getByRole("button", { name: "Envoyer" })).toBeDisabled();
  });

  test("answers a filled honeypot like a success, and stores nothing", async ({
    page,
  }) => {
    const subject = uniqueSubject("honeypot");
    await openReady(page);

    await fill(page, subject);
    // Inert to people, but a bot fills every field it finds.
    await page
      .locator(`input[name="${HONEYPOT_FIELD}"]`)
      .evaluate((field: HTMLInputElement) => {
        field.value = "https://spam.example";
      });
    await send(page);

    await expect(formOf(page).getByRole("status")).toHaveText(/Message envoyé/);
    expect(await countContactMessages(subject)).toBe(0);
  });

  test("keeps what was typed when the server refuses a field", async ({
    page,
  }) => {
    // Blank but not empty: the browser lets it through, the server does not.
    const subject = uniqueSubject("invalid");
    await openReady(page);

    await fill(page, subject, "   ");
    await send(page);

    await expect(formOf(page).getByRole("status")).toHaveText(
      /vérifiez les champs/,
    );
    const name = page.getByLabel("Nom", { exact: true });
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toBeFocused();
    await expect(page.getByLabel("Objet", { exact: true })).toHaveValue(
      subject,
    );
    await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
      "Bonjour, j'aimerais vous parler d'une mission.",
    );
    expect(await countContactMessages(subject)).toBe(0);
  });
});

test.describe("contact page without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("points to email and LinkedIn, and cannot be sent", async ({ page }) => {
    await page.goto("/fr/contact");

    await expect(
      page.getByText(/Sans JavaScript, écrivez-moi par e-mail ou sur LinkedIn/),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Envoyer" })).toBeDisabled();
    const direct = page.getByRole("region", { name: "Me joindre directement" });
    await expect(direct.getByRole("link")).toHaveCount(2);
  });
});
