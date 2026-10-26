import Link from "next/link";

import { BUTTON_CLASSES } from "@/components/ui/button-classes";
import { signOutAction } from "@/features/auth/actions";

import { AdminNav, NAV_LINK_CLASSES } from "./admin-nav";
import { ADMIN_COPY } from "./copy";

const NAV = ADMIN_COPY.nav;

interface AdminSidebarProps {
  readonly unread: number | undefined;
}

/**
 * The brand, the navigation and sign-out: a sidebar on large screens, stacked
 * above the page on small ones, so it needs no script.
 */
export function AdminSidebar({ unread }: AdminSidebarProps) {
  return (
    <header className="border-line bg-surface/80 flex flex-col gap-6 border-b px-4 py-5 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-5 lg:py-8">
      <p className="font-mono text-sm">
        <span aria-hidden="true">
          <span className="text-accent">● </span>
          orion <span className="text-fg-muted">~/admin</span>
        </span>
        <span className="sr-only">{NAV.brand}</span>
      </p>
      <AdminNav unread={unread} />
      <div className="flex flex-wrap items-center gap-3 lg:mt-auto lg:flex-col lg:items-stretch">
        {/* Another root layout: Next.js loads it as a full page. */}
        <Link href="/fr" className={NAV_LINK_CLASSES}>
          {NAV.site}
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className={`${BUTTON_CLASSES.secondary} lg:w-full lg:justify-center`}
          >
            {NAV.signOut}
          </button>
        </form>
      </div>
    </header>
  );
}
