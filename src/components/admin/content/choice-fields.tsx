"use client";

import { useId } from "react";

import { FormField } from "@/components/ui/form-field";

import { useField } from "./content-form";
import { messageOf } from "./field-message";

interface CheckboxFieldProps {
  readonly name: string;
  readonly label: string;
  readonly initial: boolean;
  readonly hint?: string;
}

/** Sent as "on" when ticked, absent otherwise. */
export function CheckboxField({
  name,
  label,
  initial,
  hint,
}: CheckboxFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const { value } = useField(name, initial ? "on" : "");
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="flex items-center gap-3 text-sm font-medium"
      >
        <input
          id={id}
          type="checkbox"
          name={name}
          defaultChecked={value === "on"}
          aria-describedby={hint === undefined ? undefined : hintId}
          className="size-4"
        />
        {label}
      </label>
      {hint !== undefined && (
        <p id={hintId} className="text-fg-muted pl-7 text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps {
  readonly name: string;
  readonly label: string;
  readonly initial: string;
  readonly options: readonly (readonly [value: string, label: string])[];
  readonly hint?: string;
  /** What another entry already holds: "Ce type de lien existe déjà." */
  readonly takenMessage?: string;
}

export function SelectField({
  name,
  label,
  initial,
  options,
  hint,
  takenMessage,
}: SelectFieldProps) {
  const id = useId();
  const { value, problem } = useField(name, initial);
  return (
    <FormField
      id={id}
      label={label}
      hint={hint}
      error={messageOf(problem, undefined, takenMessage)}
    >
      {(control) => (
        // Keyed by its value: React applies a select's defaultValue at mount only.
        <select
          key={value}
          {...control}
          name={name}
          defaultValue={value}
          required
        >
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
}
