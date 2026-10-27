import "server-only";

import { updateTag } from "next/cache";

import { tagsFor, type ContentChange } from "./content-tags";

/**
 * After a content change, from a server action: the next request waits for
 * fresh data rather than a stale page (read-your-own-writes), so the change
 * shows on the site at once. The CV PDF will regenerate from here (P9).
 */
export function revalidateContent(change: ContentChange): void {
  for (const tag of tagsFor(change)) {
    updateTag(tag);
  }
}
