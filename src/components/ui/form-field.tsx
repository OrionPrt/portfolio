import type { ReactNode } from "react";

// 16 px text: smaller sizes make iOS zoom into the field on focus. Forced
// colors drop the ring and the border color: a thicker border marks an error.
export const CONTROL_CLASSES =
  "border-control-border bg-surface text-fg rounded-control aria-invalid:border-danger aria-invalid:ring-danger w-full border px-3 py-2 text-base aria-invalid:ring-1 forced-colors:aria-invalid:border-[3px]";

/** What a control needs to be tied to its label, hint and error. */
export interface ControlProps {
  readonly id: string;
  readonly className: string;
  readonly "aria-invalid": true | undefined;
  readonly "aria-describedby": string | undefined;
}

interface FormFieldProps {
  readonly id: string;
  /** Text, or text with a visually hidden part that tells same-named fields apart. */
  readonly label: ReactNode;
  readonly hint?: string;
  readonly error?: string;
  readonly children: (control: ControlProps) => ReactNode;
}

/** A labelled control, with its hint and error read along with it. */
export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: FormFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [
    hint === undefined ? undefined : hintId,
    error === undefined ? undefined : errorId,
  ]
    .filter((part) => part !== undefined)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        className: CONTROL_CLASSES,
        "aria-invalid": error === undefined ? undefined : true,
        "aria-describedby": describedBy === "" ? undefined : describedBy,
      })}
      {hint !== undefined && (
        <p id={hintId} className="text-fg-muted text-xs">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={errorId} className="text-danger text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
