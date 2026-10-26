"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

interface FormAlertProps {
  /** The problem to announce; empty when there is none. */
  readonly message: string | undefined;
  readonly children?: ReactNode;
}

/**
 * An assertive live region, present from the start (empty, but kept in the
 * accessibility tree) so a problem is announced when it appears. It empties
 * while its form is pending, so the same problem twice is announced twice.
 */
export function FormAlert({ message, children }: FormAlertProps) {
  const { pending } = useFormStatus();
  const isShown = !pending && message !== undefined && message !== "";

  return (
    <div
      role="alert"
      className="text-danger flex flex-col gap-2 font-medium empty:sr-only"
    >
      {isShown && (
        <>
          <p>{message}</p>
          {children}
        </>
      )}
    </div>
  );
}
