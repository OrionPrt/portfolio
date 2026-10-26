import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ADMIN_COPY } from "@/components/admin/copy";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import { getUnreadCount } from "@/features/contact/inbox-queries";

export const metadata: Metadata = { title: ADMIN_COPY.dashboard.title };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.dashboard;

interface CardProps {
  readonly href: string;
  readonly title: string;
  readonly detail: string;
  readonly isHighlighted?: boolean;
}

function Card({ href, title, detail, isHighlighted = false }: CardProps) {
  return (
    <li>
      <Link
        href={href}
        className="bg-surface border-line rounded-tile hover:border-fg-muted flex h-full flex-col gap-2 border p-5 transition-colors"
      >
        <span className="text-lg font-semibold tracking-tight">{title}</span>
        <span
          className={
            isHighlighted ? "text-accent text-sm" : "text-fg-muted text-sm"
          }
        >
          {detail}
        </span>
      </Link>
    </li>
  );
}

export default async function AdminHomePage() {
  await requireAdmin();
  const unread = await getUnreadCount();

  return (
    <>
      <AdminPageHeader title={COPY.title} />
      <p className="text-fg-muted max-w-prose text-lg leading-relaxed">
        {COPY.lead}
      </p>
      {/* role="list": Safari drops list semantics once list-style is none. */}
      <ul role="list" className="grid gap-4 sm:grid-cols-2">
        <Card
          href={ADMIN_PATHS.messages}
          title={ADMIN_COPY.nav.messages}
          detail={COPY.messages(unread)}
          isHighlighted={unread !== undefined && unread > 0}
        />
        <Card
          href={ADMIN_PATHS.security}
          title={ADMIN_COPY.nav.security}
          detail={COPY.security}
        />
      </ul>
    </>
  );
}
