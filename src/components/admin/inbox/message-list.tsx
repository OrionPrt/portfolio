import Link from "next/link";

import { messagePath } from "@/features/auth/admin-paths";
import type { InboxMessageSummary } from "@/features/contact/inbox-repository";

import { ADMIN_COPY } from "../copy";
import { formatParisDateTime } from "../format";

const COPY = ADMIN_COPY.inbox;

interface MessageRowProps {
  readonly message: InboxMessageSummary;
}

/** The spaces between the parts keep the link's name readable; the grid ignores them. */
function MessageRow({ message }: MessageRowProps) {
  const isUnread = message.status === "unread";
  return (
    <Link
      href={messagePath(message.id)}
      className="hover:bg-surface-muted focus-visible:bg-surface-muted grid gap-x-6 gap-y-1 px-4 py-3 transition-colors focus-visible:-outline-offset-2 sm:grid-cols-[1fr_auto] sm:px-5"
    >
      <span className="flex min-w-0 items-center gap-2">
        {isUnread && (
          <>
            <span
              aria-hidden="true"
              className="bg-accent size-2 shrink-0 rounded-full"
            />
            <span className="sr-only">{COPY.statuses.unread},</span>{" "}
          </>
        )}
        <span className={`truncate ${isUnread ? "font-semibold" : "text-fg"}`}>
          {message.subject}
        </span>
      </span>{" "}
      <span className="text-fg-muted truncate text-sm">
        {message.name} · {message.email}
      </span>{" "}
      <time
        dateTime={message.createdAt.toISOString()}
        className="text-fg-muted font-mono text-xs sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:self-center"
      >
        {formatParisDateTime(message.createdAt)}
      </time>
    </Link>
  );
}

interface MessageListProps {
  readonly messages: readonly InboxMessageSummary[];
}

/** One row per message, newest first; unread ones stand out, in words too. */
export function MessageList({ messages }: MessageListProps) {
  return (
    // role="list": Safari drops list semantics once list-style is none.
    <ol
      role="list"
      className="border-line bg-surface rounded-tile divide-line divide-y overflow-hidden border"
    >
      {messages.map((message) => (
        <li key={message.id}>
          <MessageRow message={message} />
        </li>
      ))}
    </ol>
  );
}
