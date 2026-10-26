import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ADMIN_COPY } from "@/components/admin/copy";
import {
  describeUserAgent,
  formatParisDateTime,
} from "@/components/admin/format";
import { MessageActions } from "@/components/admin/inbox/message-actions";
import { BUTTON_CLASSES } from "@/components/ui/button-classes";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import {
  createInboxRepository,
  type InboxMessage,
} from "@/features/contact/inbox-repository";

// The subject stays out of the tab's title: it is personal data.
export const metadata: Metadata = { title: ADMIN_COPY.inbox.messageTitle };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.inbox;

/** A reply in the owner's mail app; the address was validated when stored. */
function replyHref({ email, subject }: InboxMessage): string {
  const to = encodeURIComponent(email).replace("%40", "@");
  return `mailto:${to}?subject=${encodeURIComponent(COPY.replySubject(subject))}`;
}

interface MessageViewProps {
  readonly message: InboxMessage;
}

function MessageHeader({ message }: MessageViewProps) {
  const device = describeUserAgent(message.userAgent);
  const rows = [
    [COPY.from, `${message.name} <${message.email}>`],
    [COPY.received, formatParisDateTime(message.createdAt)],
    [COPY.language, COPY.languages[message.locale]],
    ...(device === undefined ? [] : [[COPY.device, device] as const]),
  ] as const;
  return (
    <header className="flex flex-col gap-4">
      <p className="text-fg-muted font-mono text-xs tracking-wider uppercase">
        {COPY.statuses[message.status]}
      </p>
      {/* Per message: earlier messages stay mounted, hidden, with theirs. */}
      <h2
        id={`message-subject-${message.id}`}
        className="text-2xl font-semibold tracking-tight break-words"
      >
        {message.subject}
      </h2>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-fg-muted">{term}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

function MessageView({ message }: MessageViewProps) {
  return (
    <article
      aria-labelledby={`message-subject-${message.id}`}
      className="bg-surface border-line rounded-tile flex flex-col gap-6 border p-5 sm:p-8"
    >
      <MessageHeader message={message} />
      {/* Text only: React escapes it, and nothing in it becomes a link. */}
      <p className="border-line border-t pt-6 leading-relaxed break-words whitespace-pre-wrap">
        {message.body}
      </p>
      <div className="border-line flex flex-col gap-4 border-t pt-6">
        <a
          href={replyHref(message)}
          className={`${BUTTON_CLASSES.primary} self-start`}
        >
          {COPY.reply}
        </a>
        <MessageActions
          key={message.id}
          id={message.id}
          status={message.status}
        />
      </div>
    </article>
  );
}

export default async function MessagePage({
  params,
}: PageProps<"/admin/messages/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const found = await withDatabase((db) => createInboxRepository(db).find(id));

  return (
    <>
      <AdminPageHeader title={COPY.title} />
      <Link
        href={ADMIN_PATHS.messages}
        className="text-fg-muted hover:text-fg self-start text-sm underline-offset-4 hover:underline"
      >
        <span aria-hidden="true">←</span> {COPY.back}
      </Link>
      {found.ok && found.data !== undefined ? (
        <MessageView message={found.data} />
      ) : (
        <p className={found.ok ? undefined : "text-danger"}>
          {found.ok ? COPY.notFound : ADMIN_COPY.unavailable}
        </p>
      )}
    </>
  );
}
