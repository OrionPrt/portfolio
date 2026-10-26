import { MAX_OFFSET } from "@/db/limits";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";

import type { InboxView } from "./inbox-repository";

export const INBOX_PAGE_SIZE = 20;

/** Beyond this, the offset would pass the database layer's bound. */
export const INBOX_MAX_PAGE = Math.floor(MAX_OFFSET / INBOX_PAGE_SIZE);

export interface InboxQuery {
  readonly view: InboxView;
  /** 1-based. */
  readonly page: number;
}

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

/** The folder and page from the URL; anything unexpected reads as the default. */
export function parseInboxQuery(params: SearchParams): InboxQuery {
  const view = params.view === "archived" ? "archived" : "received";
  const page =
    typeof params.page === "string" && /^[1-9]\d{0,8}$/.test(params.page)
      ? Math.min(Number(params.page), INBOX_MAX_PAGE)
      : 1;
  return { view, page };
}

/**
 * Pages to show for this many messages: at least one, and no more than the
 * offset bound lets the database reach (older messages need archiving first).
 */
export function inboxPageCount(total: number): number {
  return Math.min(
    Math.max(1, Math.ceil(total / INBOX_PAGE_SIZE)),
    INBOX_MAX_PAGE,
  );
}

export function inboxHref({ view, page }: InboxQuery): string {
  const search = new URLSearchParams();
  if (view === "archived") {
    search.set("view", view);
  }
  if (page > 1) {
    search.set("page", String(page));
  }
  const query = search.toString();
  return query === ""
    ? ADMIN_PATHS.messages
    : `${ADMIN_PATHS.messages}?${query}`;
}
