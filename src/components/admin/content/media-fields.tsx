"use client";

import { useId, useLayoutEffect, useRef, type RefObject } from "react";

import { FormField } from "@/components/ui/form-field";
import { TEXT_LIMITS } from "@/features/content/limits";
import type { MediaAlt } from "@/features/content/schemas";

import { ADMIN_COPY } from "../copy";
import { useField } from "./content-form";
import { TextField } from "./text-field";

const COPY = ADMIN_COPY.media;

/** The words for a refused file: missing, not an image it takes, or one it has. */
const FILE_PROBLEMS = {
  required: COPY.fileMissing,
  invalid: COPY.fileInvalid,
  too_long: COPY.fileInvalid,
  taken: COPY.fileTaken,
} as const;

interface FileFieldProps {
  readonly name: string;
  /** The file last sent, to choose again when the refusal was not about it. */
  readonly retained?: RefObject<File | undefined>;
}

/**
 * The image to send. Mounted afresh with each outcome, it starts empty: but
 * the file last sent comes back, unless it was the problem, so the texts
 * alone are corrected (where the browser can set a file input's files).
 */
export function FileField({ name, retained }: FileFieldProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { problem } = useField(name, "");
  useLayoutEffect(() => {
    const file = retained?.current;
    const input = inputRef.current;
    if (
      file === undefined ||
      input === null ||
      typeof DataTransfer === "undefined"
    ) {
      return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
  }, [retained]);
  return (
    <FormField
      id={id}
      label={COPY.file}
      hint={COPY.fileHint}
      error={problem === undefined ? undefined : FILE_PROBLEMS[problem.problem]}
    >
      {(control) => (
        <input
          ref={inputRef}
          {...control}
          type="file"
          name={name}
          accept="image/jpeg,image/png,image/webp"
          required
        />
      )}
    </FormField>
  );
}

interface MediaAltFieldsProps {
  /** The stored texts; undefined for a new image. */
  readonly initial?: MediaAlt;
}

/** The alternative text in both languages: neither falls back on the other. */
export function MediaAltFields({ initial }: MediaAltFieldsProps) {
  const hintId = useId();
  return (
    <fieldset aria-describedby={hintId} className="flex min-w-0 flex-col gap-3">
      <legend className="mb-1 text-sm font-semibold">{COPY.alt}</legend>
      <p id={hintId} className="text-fg-muted text-xs">
        {COPY.altHint}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          name="alt.fr"
          label={ADMIN_COPY.content.locales.fr}
          lang="fr"
          initial={initial?.fr ?? ""}
          maxLength={TEXT_LIMITS.alt}
          isRequired
        />
        <TextField
          name="alt.en"
          label={ADMIN_COPY.content.locales.en}
          lang="en"
          initial={initial?.en ?? ""}
          maxLength={TEXT_LIMITS.alt}
          isRequired
        />
      </div>
    </fieldset>
  );
}
