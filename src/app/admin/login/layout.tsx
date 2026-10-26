import type { ReactNode } from "react";

import { RouteFocus } from "@/components/layout/route-focus";

interface LoginLayoutProps {
  readonly children: ReactNode;
}

/**
 * The sign-in steps' frame: one main region for both steps (Next.js keeps
 * the first step mounted, hidden), with an id of its own, apart from the
 * signed-in admin's.
 */
export default function LoginLayout({ children }: LoginLayoutProps) {
  return (
    <>
      <main
        id="admin-login-main"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center px-4 py-10 outline-none"
      >
        {children}
      </main>
      <RouteFocus targetId="admin-login-main" />
    </>
  );
}
