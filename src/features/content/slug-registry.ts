import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";

import type { SlugRedirect } from "./redirects-repository";
import { ENTRY_COLLECTIONS, type EntryCollection } from "./vocabulary";

export type PublishedSlugs = Readonly<
  Record<EntryCollection, readonly string[]>
>;

export interface SlugLists {
  readonly published: PublishedSlugs;
  readonly redirects: readonly SlugRedirect[];
}

/** What a slug leads to: its entry, a renamed entry (301), or nothing (404). */
export type SlugResolution =
  | { readonly kind: "published" }
  | { readonly kind: "redirect"; readonly to: string }
  | { readonly kind: "missing" };

interface Known {
  readonly published: Readonly<Record<EntryCollection, ReadonlySet<string>>>;
  readonly redirects: Readonly<
    Record<EntryCollection, ReadonlyMap<string, string>>
  >;
}

interface SlugRegistryOptions {
  readonly load: () => Promise<Result<SlugLists>>;
  /** How long a successful load is trusted. */
  readonly maxAgeMs: number;
  /** How long to wait after a failed load before trying again. */
  readonly retryAfterMs: number;
  /**
   * A slug missing from lists at least this old makes them load again first:
   * an entry published or renamed a moment ago is found, while a burst of
   * unknown slugs costs one load at most per period.
   */
  readonly missRefreshAfterMs: number;
  readonly now?: () => number;
}

export interface SlugRegistry {
  /** Undefined while no list could be loaded yet. */
  readonly resolve: (
    collection: EntryCollection,
    slug: string,
  ) => Promise<SlugResolution | undefined>;
}

function toKnown(lists: SlugLists): Known {
  const redirectsOf = (collection: EntryCollection) =>
    new Map(
      lists.redirects
        .filter((redirect) => redirect.collection === collection)
        .map((redirect) => [redirect.fromSlug, redirect.toSlug]),
    );
  const byCollection = <T>(of: (collection: EntryCollection) => T) =>
    Object.fromEntries(
      ENTRY_COLLECTIONS.map((collection) => [collection, of(collection)]),
    ) as Record<EntryCollection, T>;
  return {
    published: byCollection(
      (collection) => new Set(lists.published[collection]),
    ),
    redirects: byCollection(redirectsOf),
  };
}

/** A redirect counts only while its target is published: a draft is not public. */
function resolveIn(
  known: Known,
  collection: EntryCollection,
  slug: string,
): SlugResolution {
  if (known.published[collection].has(slug)) {
    return { kind: "published" };
  }
  const to = known.redirects[collection].get(slug);
  return to !== undefined && known.published[collection].has(to)
    ? { kind: "redirect", to }
    : { kind: "missing" };
}

/** The same answer from lists at hand: for a page whose entry is gone. */
export function resolveSlug(
  lists: SlugLists,
  collection: EntryCollection,
  slug: string,
): SlugResolution {
  return resolveIn(toKnown(lists), collection, slug);
}

/**
 * The published slugs and the redirects, kept in memory for the proxy's 404s
 * and 301s. The proxy runs apart from rendering and cannot use "use cache",
 * hence this small cache of its own. Stale lists answer at once while they
 * refresh in the background; a failed refresh keeps them rather than opening
 * the gate, and is not retried before `retryAfterMs`.
 */
export function createSlugRegistry({
  load,
  maxAgeMs,
  retryAfterMs,
  missRefreshAfterMs,
  now = Date.now,
}: SlugRegistryOptions): SlugRegistry {
  let known: Known | undefined;
  let refreshAfter = 0;
  // The last load started, failed or not: misses wait for the period after it.
  let attemptedAt = Number.NEGATIVE_INFINITY;
  let pending: Promise<void> | undefined;

  // A load that throws counts as a failed one: the proxy must not answer 500.
  const settle = async (): Promise<Result<SlugLists> | undefined> => {
    try {
      return await load();
    } catch (error) {
      logger.warn("slugs.load_failed", { error });
      return undefined;
    }
  };

  const refresh = (): Promise<void> => {
    pending ??= (async () => {
      attemptedAt = now();
      const result = await settle();
      if (result?.ok === true) {
        known = toKnown(result.data);
        refreshAfter = now() + maxAgeMs;
      } else {
        refreshAfter = now() + retryAfterMs;
      }
    })().finally(() => {
      pending = undefined;
    });
    return pending;
  };

  return {
    resolve: async (collection, slug) => {
      if (now() >= refreshAfter) {
        const refreshing = refresh();
        // Only the very first load is awaited: later refreshes run in the
        // background while the last lists answer (stale-while-revalidate).
        if (known === undefined) {
          await refreshing;
        }
      }
      if (known === undefined) {
        return undefined;
      }
      const resolution = resolveIn(known, collection, slug);
      if (resolution.kind !== "missing") {
        return resolution;
      }
      // A miss: the lists may predate a publication or a rename.
      const isRecent = now() - attemptedAt < missRefreshAfterMs;
      // Loaded a moment ago: the miss stands.
      const isFresh = pending === undefined && isRecent;
      // Still loading a period on: the load has hung, no one else waits on it.
      const hasHung = pending !== undefined && !isRecent;
      if (isFresh || hasHung) {
        return resolution;
      }
      // Joins the load just started (the lists were stale), or starts one.
      await refresh();
      return resolveIn(known, collection, slug);
    },
  };
}
