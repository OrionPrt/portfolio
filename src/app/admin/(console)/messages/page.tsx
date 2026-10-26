import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ADMIN_COPY } from "@/components/admin/copy";
import { InboxPagination } from "@/components/admin/inbox/inbox-pagination";
import { MessageList } from "@/components/admin/inbox/message-list";
import { withDatabase } from "@/db/client";
import { requireAdmin } from "@/features/auth/dal";
import {
  INBOX_PAGE_SIZE,
  inboxHref,
  inboxPageCount,
  parseInboxQuery,
  type InboxQuery,
} from "@/features/contact/inbox-query";
import {
  createInboxRepository,
  type InboxView,
} from "@/features/contact/inbox-repository";

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.inbox;
const VIEWS: readonly InboxView[] = ["received", "archived"];

export async function generateMetadata({
  searchParams,
}: PageProps<"/admin/messages">): Promise<Metadata> {
  const { view, page } = parseInboxQuery(await searchParams);
  return { title: COPY.documentTitle(view, page) };
}

interface ViewTabsProps {
  readonly current: InboxView;
}

function ViewTabs({ current }: ViewTabsProps) {
  return (
    <nav aria-label={COPY.viewsLabel}>
      <ul role="list" className="flex gap-2">
        {VIEWS.map((view) => (
          <li key={view}>
            <Link
              href={inboxHref({ view, page: 1 })}
              aria-current={view === current ? "page" : undefined}
              className="border-line text-fg-muted hover:text-fg aria-[current=page]:border-fg aria-[current=page]:text-fg rounded-chip inline-flex min-h-10 items-center border px-3 text-sm font-medium"
            >
              {COPY.views[view]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

async function loadPage(query: InboxQuery) {
  return withDatabase((db) =>
    createInboxRepository(db).list({
      view: query.view,
      limit: INBOX_PAGE_SIZE,
      offset: (query.page - 1) * INBOX_PAGE_SIZE,
    }),
  );
}

export default async function MessagesPage({
  searchParams,
}: PageProps<"/admin/messages">) {
  await requireAdmin();
  const query = parseInboxQuery(await searchParams);
  const loaded = await loadPage(query);
  const pages = loaded.ok ? inboxPageCount(loaded.data.total) : query.page;
  // Past the last page (messages deleted meanwhile): the last one.
  if (query.page > pages) {
    redirect(inboxHref({ view: query.view, page: pages }));
  }

  return (
    <>
      <AdminPageHeader title={COPY.title} />
      <ViewTabs current={query.view} />
      {!loaded.ok ? (
        <p className="text-danger">{ADMIN_COPY.unavailable}</p>
      ) : loaded.data.messages.length === 0 ? (
        <p className="text-fg-muted">{COPY.empty[query.view]}</p>
      ) : (
        <>
          <MessageList messages={loaded.data.messages} />
          <InboxPagination query={query} pages={pages} />
        </>
      )}
    </>
  );
}
