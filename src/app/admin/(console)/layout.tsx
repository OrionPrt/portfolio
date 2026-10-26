import { Suspense, type ReactNode } from "react";

import { AdminRouteFocus } from "@/components/admin/admin-route-focus";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { ADMIN_COPY } from "@/components/admin/copy";
import { requireAdmin } from "@/features/auth/dal";
import { getUnreadCount } from "@/features/contact/inbox-queries";

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

interface ConsoleLayoutProps {
  readonly children: ReactNode;
}

/**
 * The signed-in admin's frame, shared by its pages: one sidebar and one main
 * region whatever page shows (Next.js keeps earlier pages mounted, hidden, so
 * a frame per page would repeat their ids). Pages check the session too.
 */
export default async function ConsoleLayout({ children }: ConsoleLayoutProps) {
  await requireAdmin();
  const unread = await getUnreadCount();

  return (
    <>
      <a
        href="#admin-main"
        className="bg-fg text-ground rounded-control sr-only px-4 py-2 focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-10"
      >
        {ADMIN_COPY.skipLink}
      </a>
      <div className="flex min-h-full flex-1 flex-col lg:flex-row">
        <AdminSidebar unread={unread} />
        <main
          id="admin-main"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 outline-none sm:px-8 lg:py-12"
        >
          {children}
        </main>
      </div>
      <Suspense fallback={null}>
        <AdminRouteFocus targetId="admin-main" />
      </Suspense>
    </>
  );
}
