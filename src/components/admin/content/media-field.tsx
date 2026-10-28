"use client";

import { useId, useState } from "react";

import { FormField } from "@/components/ui/form-field";
import { MediaThumbnail } from "@/components/ui/media-image";
import type { FieldProblem } from "@/features/admin/form-input";
import type { MediaOption } from "@/features/media/types";

import { ADMIN_COPY } from "../copy";
import { useField } from "./content-form";
import { messageOf } from "./field-message";

const COPY = ADMIN_COPY.mediaField;

interface MediaFieldProps {
  /** Sent with the image's id, or empty for none. */
  readonly name: string;
  readonly label: string;
  readonly initial: string | null;
  /** The library's images. */
  readonly options: readonly MediaOption[];
}

interface MediaChoiceProps extends Omit<MediaFieldProps, "initial"> {
  /** What the select starts from: the stored or the sent value. */
  readonly value: string;
  readonly problem: FieldProblem | undefined;
}

/** The select and the glimpse of its choice, one state for both. */
function MediaChoice({
  name,
  label,
  options,
  value,
  problem,
}: MediaChoiceProps) {
  const id = useId();
  const [chosen, setChosen] = useState(value);
  const option = options.find((candidate) => candidate.id === chosen);
  return (
    <div className="flex flex-col gap-3">
      <FormField
        id={id}
        label={label}
        hint={COPY.hint}
        error={messageOf(problem)}
      >
        {(control) => (
          <select
            {...control}
            name={name}
            defaultValue={value}
            onChange={(event) => {
              setChosen(event.currentTarget.value);
            }}
          >
            <option value="">{COPY.none}</option>
            {options.map((image) => (
              <option key={image.id} value={image.id}>
                {image.alt}
              </option>
            ))}
          </select>
        )}
      </FormField>
      {option !== undefined && (
        // Its text is the option chosen above: the glimpse adorns it.
        <MediaThumbnail
          variant={option.thumbnail}
          sizes="160px"
          className="bg-surface-muted border-line rounded-control h-24 w-auto self-start border object-contain"
        />
      )}
    </div>
  );
}

/** An image of the library, or none, with a glimpse of the one chosen. */
export function MediaField({ name, label, initial, options }: MediaFieldProps) {
  const { value, problem } = useField(name, initial ?? "");
  // Keyed by its value: React applies a select's defaultValue at mount only,
  // and the glimpse starts again with it.
  return (
    <MediaChoice
      key={value}
      name={name}
      label={label}
      options={options}
      value={value}
      problem={problem}
    />
  );
}
