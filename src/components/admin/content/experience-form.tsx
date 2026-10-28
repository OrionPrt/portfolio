import type { ContentAction } from "@/features/admin/content-form-state";
import type { SkillOption } from "@/features/catalog/skill-options";
import { TEXT_LIMITS } from "@/features/content/limits";
import { EMPLOYMENT_TYPES } from "@/features/content/vocabulary";
import type { ExperienceForEdit } from "@/features/experiences/admin-repository";
import type { MediaOption } from "@/features/media/types";

import { ADMIN_COPY } from "../copy";
import { SelectField } from "./choice-fields";
import { ContentForm } from "./content-form";
import {
  BilingualFields,
  DateFields,
  FormSection,
  PublicationFields,
  SUMMARY_FIELDS,
  UrlField,
  type TranslatedField,
} from "./entry-fields";
import { MediaField } from "./media-field";
import { MediaOptionsProvider } from "./media-options";
import { SkillPicker } from "./skill-picker";
import { TextField } from "./text-field";

const COPY = ADMIN_COPY.experiences;
const ENTRIES = ADMIN_COPY.entries;

const EMPLOYMENT_OPTIONS = EMPLOYMENT_TYPES.map(
  (type) => [type, COPY.employmentTypes[type]] as const,
);

type Translated = keyof NonNullable<ExperienceForEdit["translations"]["fr"]>;

const SUMMARY: readonly TranslatedField<Translated>[] = [
  {
    name: "role",
    label: COPY.role,
    maxLength: TEXT_LIMITS.title,
    isRequired: true,
  },
  ...SUMMARY_FIELDS,
];

interface ExperienceFormProps {
  readonly action: ContentAction;
  /** The experience to edit; undefined for a new one. */
  readonly experience?: ExperienceForEdit;
  /** The catalog its skills are picked from. */
  readonly skills: readonly SkillOption[];
  /** The library its logo is picked from. */
  readonly media: readonly MediaOption[];
}

function PositionFields({
  experience,
  media,
}: Pick<ExperienceFormProps, "experience" | "media">) {
  return (
    <FormSection title={COPY.position}>
      <div className="grid gap-6 md:grid-cols-2">
        <TextField
          name="company"
          label={COPY.company}
          initial={experience?.company ?? ""}
          maxLength={TEXT_LIMITS.name}
          isRequired
        />
        <SelectField
          name="employmentType"
          label={COPY.employmentType}
          initial={experience?.employmentType ?? "full_time"}
          options={EMPLOYMENT_OPTIONS}
        />
        <TextField
          name="location"
          label={COPY.location}
          hint={ENTRIES.optional}
          initial={experience?.location ?? ""}
          maxLength={TEXT_LIMITS.name}
        />
        <UrlField
          name="companyUrl"
          label={COPY.companyUrl}
          initial={experience?.companyUrl ?? null}
        />
      </div>
      <MediaField
        name="logoMediaId"
        label={COPY.logo}
        initial={experience?.logoMediaId ?? null}
        options={media}
      />
      <DateFields
        start={{ initial: experience?.startedOn ?? null, isRequired: true }}
        end={{
          initial: experience?.endedOn ?? null,
          hint: COPY.endedOnHint,
          invalid: COPY.endedOnInvalid,
        }}
      />
    </FormSection>
  );
}

/** An experience in both languages, with its dates and skills; one save for all of it. */
export function ExperienceForm({
  action,
  experience,
  skills,
  media,
}: ExperienceFormProps) {
  return (
    <MediaOptionsProvider options={media}>
      <ContentForm
        action={action}
        hidden={experience === undefined ? {} : { id: experience.id }}
      >
        <PublicationFields
          status={experience?.status ?? "draft"}
          slug={experience?.slug ?? ""}
          slugTaken={COPY.slugTaken}
        />
        <PositionFields experience={experience} media={media} />
        <FormSection title={ENTRIES.summary}>
          <BilingualFields
            fields={SUMMARY}
            translations={experience?.translations}
          />
        </FormSection>
        <SkillPicker
          name="skills"
          skills={skills}
          initial={experience?.skills ?? []}
        />
      </ContentForm>
    </MediaOptionsProvider>
  );
}
