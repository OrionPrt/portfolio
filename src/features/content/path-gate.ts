import { matchRoute } from "@/i18n/route-match";
import { isSlug } from "@/lib/slug";

import type { SlugRegistry } from "./slug-registry";

/** Where an internal pathname (after next-intl's rewrite) leads. */
export type PathOutcome =
  | { readonly kind: "known" }
  /** A renamed entry's old slug: the same path with this slug instead. */
  | { readonly kind: "redirect"; readonly slug: string }
  | { readonly kind: "unknown" };

export interface PathGate {
  readonly check: (pathname: string) => Promise<PathOutcome>;
}

const KNOWN: PathOutcome = { kind: "known" };
const UNKNOWN: PathOutcome = { kind: "unknown" };

export function createPathGate(slugs: SlugRegistry): PathGate {
  return {
    check: async (pathname) => {
      const match = matchRoute(pathname);
      if (match.kind !== "entry") {
        return match.kind === "page" ? KNOWN : UNKNOWN;
      }
      if (!isSlug(match.slug)) {
        return UNKNOWN;
      }
      const resolution = await slugs.resolve(match.collection, match.slug);
      switch (resolution?.kind) {
        // Unknown slugs (database down): the page still checks, and 404s softly.
        case undefined:
        case "published":
          return KNOWN;
        case "redirect":
          return { kind: "redirect", slug: resolution.to };
        case "missing":
          return UNKNOWN;
      }
    },
  };
}
