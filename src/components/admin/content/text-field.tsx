"use client";

import { useId } from "react";

import { FormField } from "@/components/ui/form-field";

import { useField } from "./content-form";
import { messageOf } from "./field-message";

interface TextFieldProps {
  readonly name: string;
  readonly label: string;
  readonly initial: string;
  readonly hint?: string;
  readonly maxLength?: number;
  readonly isRequired?: boolean;
  readonly isMultiline?: boolean;
  /** What the field expects, shown when its value is refused. */
  readonly invalidMessage?: string;
  /** What another entry already holds: "Ce slug est déjà pris." */
  readonly takenMessage?: string;
  readonly type?: "text" | "url";
  readonly autoComplete?: string;
}

/** A text field of a content form; its id is unique, whatever page stays mounted. */
export function TextField({
  name,
  label,
  initial,
  hint,
  maxLength,
  isRequired = false,
  isMultiline = false,
  invalidMessage,
  takenMessage,
  type = "text",
  autoComplete = "off",
}: TextFieldProps) {
  const id = useId();
  const { value, problem } = useField(name, initial);
  return (
    <FormField
      id={id}
      label={label}
      hint={hint}
      error={messageOf(problem, invalidMessage, takenMessage)}
    >
      {(control) =>
        isMultiline ? (
          <textarea
            {...control}
            name={name}
            defaultValue={value}
            required={isRequired}
            maxLength={maxLength}
            rows={4}
          />
        ) : (
          <input
            {...control}
            name={name}
            type={type}
            defaultValue={value}
            required={isRequired}
            maxLength={maxLength}
            autoComplete={autoComplete}
            spellCheck={type === "text"}
          />
        )
      }
    </FormField>
  );
}
