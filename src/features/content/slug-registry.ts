import type { EntryCollection } from "@/i18n/route-match";
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";

export type SlugLists = Readonly<Record<EntryCollection, readonly string[]>>;

type SlugSets = Readonly<Record<EntryCollection, ReadonlySet<string>>>;

interface SlugRegistryOptions {
  readonly load: () => Promise<Result<SlugLists>>;
  /** How long a successful load is trusted. */
  readonly maxAgeMs: number;
  /** How long to wait after a failed load before trying again. */
  readonly retryAfterMs: number;
  readonly now?: () => number;
}

export interface SlugRegistry {
  /** Whether the slug is published; undefined while no list could be loaded yet. */
  readonly has: (
    collection: EntryCollection,
    slug: string,
  ) => Promise<boolean | undefined>;
}

function toSets(lists: SlugLists): SlugSets {
  return {
    projects: new Set(lists.projects),
    experiences: new Set(lists.experiences),
  };
}

/**
 * The published slugs, kept in memory for the proxy's 404 check. The proxy runs
 * apart from rendering and cannot use "use cache", hence this small cache of
 * its own. Stale lists answer at once while they refresh in the background; a
 * failed refresh keeps them rather than opening the gate, and is not retried
 * before `retryAfterMs`, so an outage is not hammered.
 */
export function createSlugRegistry({
  load,
  maxAgeMs,
  retryAfterMs,
  now = Date.now,
}: SlugRegistryOptions): SlugRegistry {
  let known: SlugSets | undefined;
  let refreshAfter = 0;
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

  const refresh = async (): Promise<void> => {
    const result = await settle();
    if (result?.ok === true) {
      known = toSets(result.data);
      refreshAfter = now() + maxAgeMs;
    } else {
      refreshAfter = now() + retryAfterMs;
    }
  };

  return {
    has: async (collection, slug) => {
      if (now() >= refreshAfter) {
        pending ??= refresh().finally(() => {
          pending = undefined;
        });
        // Only the very first load is awaited: later refreshes run in the
        // background while the last lists answer (stale-while-revalidate).
        if (known === undefined) {
          await pending;
        }
      }
      return known?.[collection].has(slug);
    },
  };
}
