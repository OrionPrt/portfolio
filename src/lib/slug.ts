/**
 * Lower-case kebab-case: letters, digits and single inner hyphens. Shared by the
 * database CHECK constraints and the Zod schemas, so both reject the same values.
 * Also keeps slugs valid in URLs and in view-transition names.
 */
export const SLUG_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$";

/** Room for any title, and short enough for URLs and cache tags (Next caps tags at 256). */
export const MAX_SLUG_LENGTH = 80;

const SLUG_REGEX = new RegExp(SLUG_PATTERN);

export function isSlug(value: string): boolean {
  return value.length <= MAX_SLUG_LENGTH && SLUG_REGEX.test(value);
}
