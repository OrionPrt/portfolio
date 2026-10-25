import type { ReactNode } from "react";

interface EyebrowProps {
  readonly children: ReactNode;
  /** A heading when the label is the only title of its tile or section. */
  readonly as?: "p" | "h2";
  readonly id?: string;
  readonly className?: string;
}

/** The mono `// label` that opens every tile and view (Graphite direction). */
export function Eyebrow({
  children,
  as: Element = "p",
  id,
  className = "",
}: EyebrowProps) {
  return (
    <Element id={id} className={`text-fg-muted font-mono text-xs ${className}`}>
      <span aria-hidden="true">{"// "}</span>
      {children}
    </Element>
  );
}
