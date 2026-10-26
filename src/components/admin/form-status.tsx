"use client";

import { useFormStatus } from "react-dom";

interface FormStatusProps {
  /** The outcome to announce politely; empty when there is none. */
  readonly message: string | undefined;
}

/** A polite live region, like FormAlert: present from the start, empty while pending. */
export function FormStatus({ message }: FormStatusProps) {
  const { pending } = useFormStatus();

  return (
    <p role="status" className="text-accent font-medium empty:sr-only">
      {pending ? "" : (message ?? "")}
    </p>
  );
}
