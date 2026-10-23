/** Marks seed text still to be written. The seed reports how many remain. */
export const PLACEHOLDER = "[À COMPLÉTER]";

export function countPlaceholders(content: unknown): number {
  return JSON.stringify(content).split(PLACEHOLDER).length - 1;
}
