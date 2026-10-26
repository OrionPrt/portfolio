"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { BUTTON_CLASSES } from "@/components/ui/button-classes";

interface SubmitButtonProps {
  readonly children: ReactNode;
  readonly pendingLabel: string;
  readonly look?: keyof typeof BUTTON_CLASSES;
  /** Sent with the form when this button submits it, to tell two buttons apart. */
  readonly name?: string;
  readonly value?: string;
}

/**
 * Stays focusable while its form is pending (aria-disabled, not disabled), so
 * focus is not lost, and ignores a second click meanwhile.
 */
export function SubmitButton({
  children,
  pendingLabel,
  look = "primary",
  name,
  value,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      aria-disabled={pending ? true : undefined}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
        }
      }}
      className={`${BUTTON_CLASSES[look]} self-start aria-disabled:cursor-wait aria-disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
