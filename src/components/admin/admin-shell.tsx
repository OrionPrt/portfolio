import Link from "next/link";
import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ui/eyebrow";
import { BUTTON_CLASSES } from "@/components/ui/button-classes";
import { signOutAction } from "@/features/auth/actions";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";

import { ADMIN_COPY } from "./copy";

interface AdminShellProps {
  readonly title: string;
  /** The page being shown, marked in the navigation. */
  readonly current: "home" | "security";
  readonly children: ReactNode;
}

const NAV = [
  ["home", ADMIN_PATHS.home, ADMIN_COPY.nav.dashboard],
  ["security", ADMIN_PATHS.security, ADMIN_COPY.nav.security],
] as const;

/** The signed-in admin: a header with the navigation and sign-out, then the page. */
export function AdminShell({ title, current, children }: AdminShellProps) {
  return (
    <>
      <a
        href="#admin-main"
        className="bg-fg text-ground rounded-control sr-only px-4 py-2 focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
      >
        {ADMIN_COPY.skipLink}
      </a>
      <header className="border-line border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <p className="font-mono text-sm">
            <span aria-hidden="true">
              <span className="text-accent">● </span>
              orion <span className="text-fg-muted">~/admin</span>
            </span>
            <span className="sr-only">{ADMIN_COPY.nav.brand}</span>
          </p>
          <nav aria-label={ADMIN_COPY.nav.label}>
            {/* role="list": Safari drops list semantics once list-style is none. */}
            <ul
              role="list"
              className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
            >
              {NAV.map(([key, href, label]) => (
                <li key={key}>
                  <Link
                    href={href}
                    aria-current={key === current ? "page" : undefined}
                    className="text-fg-muted hover:text-fg aria-[current=page]:text-fg inline-flex min-h-6 items-center aria-[current=page]:underline aria-[current=page]:underline-offset-4"
                  >
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                {/* Another root layout: Next.js loads it as a full page. */}
                <Link
                  href="/fr"
                  className="text-fg-muted hover:text-fg inline-flex min-h-6 items-center"
                >
                  {ADMIN_COPY.nav.site}
                </Link>
              </li>
              <li>
                <form action={signOutAction}>
                  <button type="submit" className={BUTTON_CLASSES.secondary}>
                    {ADMIN_COPY.nav.signOut}
                  </button>
                </form>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main
        id="admin-main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-10 outline-none sm:px-8"
      >
        <header className="flex flex-col gap-3">
          <Eyebrow>{ADMIN_COPY.label}</Eyebrow>
          <h1 className="text-[clamp(32px,4vw,48px)] leading-tight font-semibold tracking-[-0.03em]">
            {title}
          </h1>
        </header>
        {children}
      </main>
    </>
  );
}
