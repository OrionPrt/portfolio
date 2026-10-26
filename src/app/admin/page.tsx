import type { Metadata } from "next";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { ADMIN_COPY } from "@/components/admin/copy";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";

export const metadata: Metadata = { title: ADMIN_COPY.dashboard.title };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

export default async function AdminHomePage() {
  await requireAdmin();
  const COPY = ADMIN_COPY.dashboard;

  return (
    <AdminShell title={COPY.title} current="home">
      <p className="text-fg-muted max-w-prose text-lg leading-relaxed">
        {COPY.lead}
      </p>
      <Link
        href={ADMIN_PATHS.security}
        className="bg-surface border-line rounded-tile hover:border-fg-muted flex max-w-md flex-col gap-2 border p-5 transition-colors"
      >
        <span className="text-lg font-semibold tracking-tight">
          {ADMIN_COPY.nav.security}
        </span>
        <span className="text-fg-muted text-sm">{COPY.security}</span>
      </Link>
    </AdminShell>
  );
}
