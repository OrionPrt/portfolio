import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { ThemeScript } from "@/components/theme/theme-script";
import { FONT_VARIABLES } from "@/styles/fonts";

import "@/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s · Administration" },
  // Never indexed, whatever the site's launch state.
  robots: { index: false, follow: false },
};

// Rendered per request, like the site: scripts carry the CSP nonce (ADR-0002).
export const instant = false;

interface AdminLayoutProps {
  readonly children: ReactNode;
}

/**
 * The admin's own root layout: French only, outside the locale routing, no
 * analytics. Pages check the session themselves (features/auth/dal).
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="fr"
      className={`${FONT_VARIABLES} h-full`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript nonce={nonce} />
      </head>
      <body className="bg-ground text-fg bg-dot-grid flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
