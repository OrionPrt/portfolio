import type { ContentAction } from "@/features/admin/content-form-state";
import type { EducationForEdit } from "@/features/catalog/education-admin-repository";
import { TEXT_LIMITS } from "@/features/content/limits";

import { ADMIN_COPY } from "../copy";
import { ContentForm } from "./content-form";
import {
  BilingualFields,
  DateFields,
  FormSection,
  type TranslatedField,
} from "./entry-fields";
import { TextField } from "./text-field";

const COPY = ADMIN_COPY.education;

type Translated = keyof NonNullable<EducationForEdit["translations"]["fr"]>;

const TRANSLATED: readonly TranslatedField<Translated>[] = [
  {
    name: "degree",
    label: COPY.degree,
    hint: COPY.degreeHint,
    maxLength: TEXT_LIMITS.title,
    isRequired: true,
  },
  {
    name: "description",
    label: COPY.description,
    hint: COPY.descriptionHint,
    kind: "multiline",
    maxLength: TEXT_LIMITS.summary,
  },
];

interface EducationFormProps {
  readonly action: ContentAction;
  /** The entry to edit; undefined for a new one. */
  readonly entry?: EducationForEdit;
}

/** A degree or course in both languages, with its school and dates; public once saved. */
export function EducationForm({ action, entry }: EducationFormProps) {
  return (
    <ContentForm
      action={action}
      hidden={entry === undefined ? {} : { id: entry.id }}
      saveNote={ADMIN_COPY.entries.publicOnSave}
    >
      <FormSection title={COPY.studies}>
        <BilingualFields
          fields={TRANSLATED}
          translations={entry?.translations}
        />
        <div className="grid gap-6 md:grid-cols-2">
          <TextField
            name="school"
            label={COPY.school}
            initial={entry?.school ?? ""}
            maxLength={TEXT_LIMITS.name}
            isRequired
          />
          <TextField
            name="location"
            label={COPY.location}
            hint={ADMIN_COPY.entries.optional}
            initial={entry?.location ?? ""}
            maxLength={TEXT_LIMITS.name}
          />
        </div>
        <DateFields
          start={{ initial: entry?.startedOn ?? null, isRequired: true }}
          end={{
            initial: entry?.endedOn ?? null,
            hint: COPY.endedOnHint,
            invalid: COPY.endedOnInvalid,
          }}
        />
      </FormSection>
    </ContentForm>
  );
}
