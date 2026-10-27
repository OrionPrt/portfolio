import {
  ENTRY_COLLECTIONS,
  type EntryCollection,
} from "@/features/content/vocabulary";

import { LOCALES, type Locale } from "./locales";
import { routing } from "./routing";

export { ENTRY_COLLECTIONS, type EntryCollection };

export type RouteMatch =
  | { readonly kind: "page"; readonly locale: Locale }
  | {
      readonly kind: "entry";
      readonly locale: Locale;
      readonly collection: EntryCollection;
      readonly slug: string;
    }
  | { readonly kind: "unknown"; readonly locale: Locale | undefined };

const PARAM_SEGMENT = /^\[\w+\]$/;

function isLocale(value: string | undefined): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

function isCollection(value: string | undefined): value is EntryCollection {
  return ENTRY_COLLECTIONS.some((collection) => collection === value);
}

function decodeSegment(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

/** Matches path segments (after the locale) against one route of `routing.pathnames`. */
function matchPattern(
  segments: readonly string[],
  pattern: string,
  locale: Locale,
): RouteMatch | undefined {
  const parts = pattern.split("/").filter(Boolean);
  if (parts.length !== segments.length) {
    return undefined;
  }
  let slug: string | undefined;
  for (const [index, part] of parts.entries()) {
    const segment = segments[index] ?? "";
    if (PARAM_SEGMENT.test(part)) {
      slug = decodeSegment(segment);
      if (slug === undefined) {
        return undefined;
      }
    } else if (part !== segment) {
      return undefined;
    }
  }
  if (slug === undefined) {
    return { kind: "page", locale };
  }
  const [collection] = parts;
  return isCollection(collection)
    ? { kind: "entry", locale, collection, slug }
    : undefined;
}

/**
 * Matches an internal pathname (`/<locale>/<english route>`, after next-intl's
 * rewrite) against the routes declared in `routing.pathnames`.
 */
export function matchRoute(pathname: string): RouteMatch {
  const [first, ...segments] = pathname.split("/").filter(Boolean);
  if (!isLocale(first)) {
    return { kind: "unknown", locale: undefined };
  }
  for (const pattern of Object.keys(routing.pathnames)) {
    const match = matchPattern(segments, pattern, first);
    if (match !== undefined) {
      return match;
    }
  }
  return { kind: "unknown", locale: first };
}
