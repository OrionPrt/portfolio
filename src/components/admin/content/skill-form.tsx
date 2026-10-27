import type { ContentFormState } from "@/features/admin/content-form-state";
import type { SkillForEdit } from "@/features/catalog/skills-admin-repository";
import { TEXT_LIMITS } from "@/features/content/limits";
import { SKILL_DOMAINS } from "@/features/content/vocabulary";
import { MAX_SLUG_LENGTH } from "@/lib/slug";

import { ADMIN_COPY } from "../copy";
import { CheckboxField, SelectField } from "./choice-fields";
import { ContentForm } from "./content-form";
import { TextField } from "./text-field";

const COPY = ADMIN_COPY.skills;

const DOMAIN_OPTIONS = SKILL_DOMAINS.map(
  (domain) => [domain, COPY.domains[domain]] as const,
);

interface SkillFormProps {
  readonly action: (
    state: ContentFormState,
    formData: FormData,
  ) => Promise<ContentFormState>;
  /** The skill to edit; undefined for a new one. */
  readonly skill?: SkillForEdit;
}

export function SkillForm({ action, skill }: SkillFormProps) {
  return (
    <ContentForm
      action={action}
      hidden={skill === undefined ? {} : { id: skill.id }}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <TextField
          name="name"
          label={COPY.name}
          initial={skill?.name ?? ""}
          maxLength={TEXT_LIMITS.name}
          isRequired
        />
        <TextField
          name="slug"
          label={COPY.slug}
          hint={COPY.slugHint}
          invalidMessage={COPY.slugInvalid}
          takenMessage={COPY.slugTaken}
          initial={skill?.slug ?? ""}
          maxLength={MAX_SLUG_LENGTH}
          isRequired
        />
        <SelectField
          name="domain"
          label={COPY.domain}
          initial={skill?.domain ?? "web"}
          options={DOMAIN_OPTIONS}
        />
      </div>
      <CheckboxField
        name="featured"
        label={COPY.featured}
        hint={COPY.featuredHint}
        initial={skill?.featured ?? false}
      />
    </ContentForm>
  );
}
