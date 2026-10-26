import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ui/eyebrow";

import { ADMIN_COPY } from "./copy";

interface AuthCardProps {
  readonly title: string;
  readonly lead?: string;
  readonly children: ReactNode;
}

/** The login steps: one narrow card, centered, with the page's only h1. */
export function AuthCard({ title, lead, children }: AuthCardProps) {
  return (
    <main
      id="admin-main"
      tabIndex={-1}
      className="flex flex-1 items-center justify-center px-4 py-10 outline-none"
    >
      <section
        aria-labelledby="admin-title"
        className="bg-surface border-line rounded-tile flex w-full max-w-md flex-col gap-6 border p-6 sm:p-8"
      >
        <header className="flex flex-col gap-3">
          <Eyebrow>{ADMIN_COPY.label}</Eyebrow>
          <h1
            id="admin-title"
            className="text-3xl font-semibold tracking-tight"
          >
            {title}
          </h1>
          {lead !== undefined && (
            <p className="text-fg-muted leading-relaxed">{lead}</p>
          )}
        </header>
        {children}
      </section>
    </main>
  );
}
