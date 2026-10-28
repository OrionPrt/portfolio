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

/** Letters NFKD leaves whole: written out the usual way. */
const SPELLED_OUT: Readonly<Record<string, string>> = {
  æ: "ae",
  œ: "oe",
  ß: "ss",
  ø: "o",
  đ: "d",
  ł: "l",
  þ: "th",
};

/** What a slug falls back on when the text has no Latin letter or digit. */
const FALLBACK_SLUG = "entree";

/**
 * A slug from a name: accents dropped, any other run of characters a single
 * hyphen, cut to the maximum length. "Diplôme d'ingénieur" gives
 * "diplome-d-ingenieur".
 */
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[æœßøđłþ]/g, (letter) => SPELLED_OUT[letter] ?? letter)
    // NFKD also brings fullwidth letters and ligatures back to plain ones.
    .normalize("NFKD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-$/, "");
  return slug === "" ? FALLBACK_SLUG : slug;
}
