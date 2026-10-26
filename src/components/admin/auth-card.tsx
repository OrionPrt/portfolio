import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ui/eyebrow";

import { ADMIN_COPY } from "./copy";

interface AuthCardProps {
  /** Unique per step: an earlier step stays mounted, hidden, next to this one. */
  readonly titleId: string;
  readonly title: string;
  readonly lead?: string;
  readonly children: ReactNode;
}

/** The login steps: one narrow card, centered by the layout, with the page's only h1. */
export function AuthCard({ titleId, title, lead, children }: AuthCardProps) {
  return (
    <section
      aria-labelledby={titleId}
      className="bg-surface border-line rounded-tile flex w-full max-w-md flex-col gap-6 border p-6 sm:p-8"
    >
      <header className="flex flex-col gap-3">
        <Eyebrow>{ADMIN_COPY.label}</Eyebrow>
        <h1 id={titleId} className="text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        {lead !== undefined && (
          <p className="text-fg-muted leading-relaxed">{lead}</p>
        )}
      </header>
      {children}
    </section>
  );
}
