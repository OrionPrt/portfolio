import { expect, test, type Page } from "@playwright/test";

const PROJECT_GROUP = "::view-transition-group(project-demo)";

interface TransitionLog {
  count: number;
  pseudoElements: string[];
  /** Durations (ms) of the view-transition animations, captured when they start. */
  durations: number[];
}

/** Wraps document.startViewTransition to record each transition and what it animated. */
async function recordViewTransitions(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: TransitionLog = { count: 0, pseudoElements: [], durations: [] };
    (window as Window & { transitionLog?: TransitionLog }).transitionLog = log;
    const original = document.startViewTransition.bind(document);
    document.startViewTransition = ((
      update: Parameters<typeof original>[0],
    ) => {
      const transition = original(update);
      log.count += 1;
      transition.ready
        .then(() => {
          for (const animation of document.getAnimations()) {
            const pseudo = (animation.effect as KeyframeEffect | null)
              ?.pseudoElement;
            if (pseudo) {
              log.pseudoElements.push(pseudo);
              log.durations.push(
                Number(animation.effect?.getTiming().duration ?? 0),
              );
            }
          }
        })
        .catch(() => undefined);
      return transition;
    }) as typeof document.startViewTransition;
  });
}

function transitionLog(page: Page): Promise<TransitionLog | undefined> {
  return page.evaluate(
    () => (window as Window & { transitionLog?: TransitionLog }).transitionLog,
  );
}

function projectTile(page: Page) {
  return page.getByRole("link", { name: /Nom du projet phare/ });
}

test.describe("bento prototype", () => {
  test("morphs the featured project tile into its full-screen view", async ({
    page,
  }) => {
    await recordViewTransitions(page);
    await page.goto("/fr");

    await projectTile(page).click();

    await expect(page).toHaveURL(/\/fr\/projets\/demo$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "[Nom du projet phare]",
    );
    await expect
      .poll(async () => (await transitionLog(page))?.pseudoElements ?? [])
      .toContain(PROJECT_GROUP);
  });

  test("morphs back into the tile through the back link", async ({ page }) => {
    await recordViewTransitions(page);
    await page.goto("/fr");
    await projectTile(page).click();
    await expect(page).toHaveURL(/\/fr\/projets\/demo$/);

    await page.getByRole("link", { name: /Retour à l'accueil/ }).click();

    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Orion");
    await expect
      .poll(async () => (await transitionLog(page))?.count ?? 0)
      .toBe(2);
    await expect
      .poll(
        async () =>
          (await transitionLog(page))?.pseudoElements.filter(
            (name) => name === PROJECT_GROUP,
          ).length ?? 0,
      )
      .toBeGreaterThanOrEqual(2);
  });

  // Next.js does not wrap popstate navigations in a view transition: the
  // browser's back button returns instantly, without the morph (ADR-0003).
  test("returns to the hub with the browser's back button", async ({
    page,
  }) => {
    await page.goto("/fr");
    await projectTile(page).click();
    await expect(page).toHaveURL(/\/fr\/projets\/demo$/);

    await page.goBack();

    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Orion");
  });

  test("renders the full-screen view on a direct visit", async ({ page }) => {
    await page.goto("/fr/projets/demo");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "[Nom du projet phare]",
    );
    await expect(
      page.getByRole("link", { name: /Retour à l'accueil/ }),
    ).toBeVisible();
  });

  // Soft 404 for now: Cache Components streams before notFound() runs, so the status stays
  // 200 with a noindex tag. A proxy-level check will return real 404s (ADR-0003).
  test("shows the not-found page for an unknown project", async ({ page }) => {
    await page.goto("/fr/projets/inconnu");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Page introuvable",
    );
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      /noindex/,
    );
  });
});

test.describe("bento prototype without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still opens the project through a plain link", async ({ page }) => {
    await page.goto("/fr");

    await projectTile(page).click();

    await expect(page).toHaveURL(/\/fr\/projets\/demo$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "[Nom du projet phare]",
    );
  });
});

test.describe("bento prototype with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("still runs the transition, with every animation cut to nothing", async ({
    page,
  }) => {
    await recordViewTransitions(page);
    await page.goto("/fr");

    await projectTile(page).click();

    await expect(page).toHaveURL(/\/fr\/projets\/demo$/);
    await expect
      .poll(async () => (await transitionLog(page))?.durations.length ?? 0)
      .toBeGreaterThan(0);
    const durations = (await transitionLog(page))?.durations ?? [];
    expect(durations.every((duration) => duration < 1)).toBe(true);
  });
});
