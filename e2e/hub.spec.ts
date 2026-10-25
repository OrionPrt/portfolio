import { expect, test, type Page } from "@playwright/test";

import { FEATURED_PROJECT, OWNER_NAME } from "./support/content";
import { openHydrated } from "./support/navigation";
import {
  recordViewTransitions,
  transitionGroup,
  transitionLog,
} from "./support/view-transitions";

const PROJECT_PATH = `/fr/projets/${FEATURED_PROJECT.slug}`;
const PROJECT_GROUP = transitionGroup(`project-${FEATURED_PROJECT.slug}`);

function projectTile(page: Page) {
  return page.getByRole("link", { name: FEATURED_PROJECT.title.fr });
}

async function animatedGroups(page: Page): Promise<string[]> {
  return (await transitionLog(page))?.pseudoElements ?? [];
}

test.describe("bento hub", () => {
  test("morphs the featured project tile into its full-screen view", async ({
    page,
  }) => {
    await recordViewTransitions(page);
    await openHydrated(page, "/fr");

    await projectTile(page).click();

    await expect(page).toHaveURL(new RegExp(`${PROJECT_PATH}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      FEATURED_PROJECT.title.fr,
    );
    await expect.poll(() => animatedGroups(page)).toContain(PROJECT_GROUP);
  });

  test("morphs back into the tile through the back link", async ({ page }) => {
    await recordViewTransitions(page);
    await openHydrated(page, "/fr");
    await projectTile(page).click();
    await expect(page).toHaveURL(new RegExp(`${PROJECT_PATH}$`));

    await page.getByRole("link", { name: /Retour à l'accueil/ }).click();

    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      OWNER_NAME,
    );
    await expect
      .poll(
        async () =>
          (await animatedGroups(page)).filter((name) => name === PROJECT_GROUP)
            .length,
      )
      .toBeGreaterThanOrEqual(2);
  });

  // Next.js does not wrap popstate navigations in a view transition: the
  // browser's back button returns instantly, without the morph (ADR-0003).
  test("returns to the hub with the browser's back button", async ({
    page,
  }) => {
    await openHydrated(page, "/fr");
    await projectTile(page).click();
    await expect(page).toHaveURL(new RegExp(`${PROJECT_PATH}$`));

    await page.goBack();

    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      OWNER_NAME,
    );
  });

  test("morphs the identity tile into the about page", async ({ page }) => {
    await recordViewTransitions(page);
    await openHydrated(page, "/fr");

    await page
      .getByRole("main")
      .getByRole("link", { name: "À propos" })
      .click();

    await expect(page).toHaveURL(/\/fr\/a-propos$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      OWNER_NAME,
    );
    await expect
      .poll(() => animatedGroups(page))
      .toContain(transitionGroup("identity"));
  });

  test("morphs the skills tile into the skills page", async ({ page }) => {
    await recordViewTransitions(page);
    await openHydrated(page, "/fr");

    await page
      .getByRole("main")
      .getByRole("link", { name: "compétences" })
      .click();

    await expect(page).toHaveURL(/\/fr\/competences$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Compétences",
    );
    await expect
      .poll(() => animatedGroups(page))
      .toContain(transitionGroup("stack"));
  });
});

test.describe("full-screen views", () => {
  test("render completely on a direct visit, the technical part folded", async ({
    page,
  }) => {
    await openHydrated(page, PROJECT_PATH);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      FEATURED_PROJECT.title.fr,
    );
    await expect(
      page.getByRole("heading", { level: 2, name: "L'essentiel" }),
    ).toBeVisible();
    const technical = page.locator("details", {
      has: page.getByRole("heading", { name: "Détails techniques" }),
    });
    await expect(technical).not.toHaveAttribute("open");

    await technical
      .getByRole("heading", { name: "Détails techniques" })
      .click();

    await expect(technical).toHaveAttribute("open");
  });

  test("link each skill badge to the skill on the skills page", async ({
    page,
  }) => {
    const skill = FEATURED_PROJECT.firstSkill;
    test.skip(skill === undefined, "The featured project lists no skill.");
    await openHydrated(page, PROJECT_PATH);

    await page
      .getByRole("region", { name: "Technologies" })
      .getByRole("link")
      .first()
      .click();

    await expect(page).toHaveURL(
      new RegExp(`/fr/competences#skill-${skill ?? ""}-fr$`),
    );
    await expect(page.locator(`#skill-${skill ?? ""}-fr`)).toBeVisible();
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("opens a project through a plain link", async ({ page }) => {
    await page.goto("/fr");

    await projectTile(page).click();

    await expect(page).toHaveURL(new RegExp(`${PROJECT_PATH}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      FEATURED_PROJECT.title.fr,
    );
  });

  test("unfolds the technical details", async ({ page }) => {
    await page.goto(PROJECT_PATH);
    const technical = page.locator("details");

    await technical
      .getByRole("heading", { name: "Détails techniques" })
      .click();

    await expect(technical).toHaveAttribute("open");
  });

  test("filters the projects through the URL", async ({ page }) => {
    await page.goto("/fr/projets");

    await page.getByLabel("Domaine").selectOption("web");
    await page.getByRole("button", { name: "Filtrer" }).click();

    await expect(page).toHaveURL(/\/fr\/projets\?domain=web/);
    await expect(page.getByLabel("Domaine")).toHaveValue("web");
    await expect(
      page.getByRole("link", { name: FEATURED_PROJECT.title.fr }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Tout afficher" }),
    ).toBeVisible();
  });
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("still runs the transition, with every animation cut to nothing", async ({
    page,
  }) => {
    await recordViewTransitions(page);
    await openHydrated(page, "/fr");

    await projectTile(page).click();

    await expect(page).toHaveURL(new RegExp(`${PROJECT_PATH}$`));
    await expect
      .poll(async () => (await transitionLog(page))?.durations.length ?? 0)
      .toBeGreaterThan(0);
    const durations = (await transitionLog(page))?.durations ?? [];
    expect(durations.every((duration) => duration < 1)).toBe(true);
  });
});
