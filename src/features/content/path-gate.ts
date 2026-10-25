import { matchRoute } from "@/i18n/route-match";
import { isSlug } from "@/lib/slug";

import type { SlugRegistry } from "./slug-registry";

export interface PathGate {
  /** Whether an internal pathname (after next-intl's rewrite) leads to content. */
  readonly isKnown: (pathname: string) => Promise<boolean>;
}

export function createPathGate(slugs: SlugRegistry): PathGate {
  return {
    isKnown: async (pathname) => {
      const match = matchRoute(pathname);
      if (match.kind !== "entry") {
        return match.kind === "page";
      }
      if (!isSlug(match.slug)) {
        return false;
      }
      // Unknown slugs (database down): the page still checks, and 404s softly.
      return (await slugs.has(match.collection, match.slug)) ?? true;
    },
  };
}
