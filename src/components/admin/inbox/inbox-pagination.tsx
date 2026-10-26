import Link from "next/link";

import { BUTTON_CLASSES } from "@/components/ui/button-classes";
import { inboxHref, type InboxQuery } from "@/features/contact/inbox-query";

import { ADMIN_COPY } from "../copy";

const COPY = ADMIN_COPY.inbox;

interface InboxPaginationProps {
  readonly query: InboxQuery;
  readonly pages: number;
}

/** Newer and older pages; nothing when everything fits on one. */
export function InboxPagination({ query, pages }: InboxPaginationProps) {
  if (pages <= 1) {
    return null;
  }
  const { view, page } = query;
  return (
    <nav
      aria-label={COPY.pagination}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      {page > 1 ? (
        <Link
          href={inboxHref({ view, page: page - 1 })}
          className={BUTTON_CLASSES.secondary}
        >
          <span aria-hidden="true">←</span> {COPY.previous}
        </Link>
      ) : (
        <span />
      )}
      <p className="text-fg-muted font-mono text-xs">
        {COPY.pageOf(page, pages)}
      </p>
      {page < pages ? (
        <Link
          href={inboxHref({ view, page: page + 1 })}
          className={BUTTON_CLASSES.secondary}
        >
          {COPY.next} <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
