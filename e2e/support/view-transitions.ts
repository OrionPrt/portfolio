import type { Page } from "@playwright/test";

export interface TransitionLog {
  count: number;
  pseudoElements: string[];
  /** Durations (ms) of the view-transition animations, captured when they start. */
  durations: number[];
}

/** Wraps document.startViewTransition to record each transition and what it animated. */
export async function recordViewTransitions(page: Page): Promise<void> {
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

export function transitionLog(page: Page): Promise<TransitionLog | undefined> {
  return page.evaluate(
    () => (window as Window & { transitionLog?: TransitionLog }).transitionLog,
  );
}

/** The pseudo-element that animates the views sharing this transition name. */
export function transitionGroup(name: string): string {
  return `::view-transition-group(${name})`;
}
