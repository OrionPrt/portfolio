"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { BUTTON_CLASSES } from "@/components/ui/button-classes";

import { ADMIN_COPY } from "./copy";

const COPY = ADMIN_COPY.recoveryCodes;

interface RecoveryCodesListProps {
  readonly codes: readonly string[];
  /** Inside a section that already says "recovery codes": a sub-heading. */
  readonly title?: string;
  readonly headingLevel?: 2 | 3;
}

/**
 * The codes, shown once: in a list to copy, never stored in clear. It
 * replaces the form that asked for them, so focus moves to its heading:
 * keyboard and screen-reader users land on the codes, not on the page top.
 */
export function RecoveryCodesList({
  codes,
  title = COPY.title,
  headingLevel = 2,
}: RecoveryCodesListProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const Heading = headingLevel === 2 ? "h2" : "h3";

  // In the commit that shows the codes: focus is there before they paint.
  useLayoutEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="recovery-codes-title"
      className="flex flex-col gap-4"
    >
      <Heading
        ref={headingRef}
        id="recovery-codes-title"
        tabIndex={-1}
        className="text-lg font-semibold tracking-tight"
      >
        {title}
      </Heading>
      <p className="text-fg-muted text-sm leading-relaxed">{COPY.lead}</p>
      {/* role="list": Safari drops list semantics once list-style is none. */}
      <ol
        role="list"
        className="bg-surface-muted rounded-control flex flex-col gap-2 p-4 font-mono text-sm whitespace-nowrap"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setCopyStatus("idle");
            navigator.clipboard.writeText(codes.join("\n")).then(
              () => {
                setCopyStatus("copied");
              },
              () => {
                setCopyStatus("failed");
              },
            );
          }}
          className={`${BUTTON_CLASSES.secondary} self-start`}
        >
          {COPY.copy}
        </button>
        <p role="status" className="text-sm empty:sr-only">
          {copyStatus === "copied" && (
            <span className="text-accent">{COPY.copied}</span>
          )}
          {copyStatus === "failed" && (
            <span className="text-danger">{COPY.copyFailed}</span>
          )}
        </p>
      </div>
    </section>
  );
}
