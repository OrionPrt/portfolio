import type { ReactNode } from "react";

interface BentoGridProps {
  readonly children: ReactNode;
}

/**
 * The hub: one screen from 1280×720, where rows share the viewport height,
 * and a page that scrolls when the content needs more room (WCAG 1.4.10).
 * Dense packing fills the holes left by a hidden tile.
 */
export function BentoGrid({ children }: BentoGridProps) {
  return (
    <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-flow-row-dense lg:auto-rows-[minmax(min-content,1fr)] lg:grid-cols-4">
      {children}
    </div>
  );
}
