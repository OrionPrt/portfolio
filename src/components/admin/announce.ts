/** The admin frame's polite live region, for outcomes whose form is gone. */
export const ANNOUNCER_ID = "admin-announcer";

/** The delay that lets the emptied region be noticed: the same words twice are read twice. */
const REANNOUNCE_DELAY_MS = 50;

/** Says it to screen readers, from wherever: the region outlives the page's forms. */
export function announce(message: string): void {
  const region = document.getElementById(ANNOUNCER_ID);
  if (region === null) {
    return;
  }
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = message;
  }, REANNOUNCE_DELAY_MS);
}
