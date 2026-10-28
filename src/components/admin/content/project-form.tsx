import type { ContentAction } from "@/features/admin/content-form-state";
import type { SkillOption } from "@/features/catalog/skill-options";
import { TEXT_LIMITS } from "@/features/content/limits";
import { SKILL_DOMAINS } from "@/features/content/vocabulary";
import type { MediaOption } from "@/features/media/types";
import type { ProjectForEdit } from "@/features/projects/admin-repository";

import { ADMIN_COPY } from "../copy";
import { CheckboxField, SelectField } from "./choice-fields";
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
import { SkillPicker } from "./skill-picker";

const COPY = ADMIN_COPY.projects;
const ENTRIES = ADMIN_COPY.entries;

const DOMAIN_OPTIONS = SKILL_DOMAINS.map(
  (domain) => [domain, ADMIN_COPY.skills.domains[domain]] as const,
);

type Translated = keyof NonNullable<ProjectForEdit["translations"]["fr"]>;

const PRESENTATION: readonly TranslatedField<Translated>[] = [
  {
    name: "title",
    label: COPY.name,
    maxLength: TEXT_LIMITS.title,
    isRequired: true,
  },
  {
    name: "tagline",
    label: COPY.tagline,
    hint: COPY.taglineHint,
    maxLength: TEXT_LIMITS.tagline,
    isRequired: true,
  },
  ...SUMMARY_FIELDS,
  {
    name: "seoDescription",
    label: COPY.seoDescription,
    hint: COPY.seoHint,
    kind: "multiline",
    maxLength: TEXT_LIMITS.seo,
  },
];

interface ProjectFormProps {
  readonly action: ContentAction;
  /** The project to edit; undefined for a new one. */
  readonly project?: ProjectForEdit;
  /** The catalog its skills are picked from. */
  readonly skills: readonly SkillOption[];
  /** The library its cover is picked from. */
  readonly media: readonly MediaOption[];
}

/** A project in both languages, with its links, dates and skills; one save for all of it. */
export function ProjectForm({
  action,
  project,
  skills,
  media,
}: ProjectFormProps) {
  return (
    <ContentForm
      action={action}
      hidden={project === undefined ? {} : { id: project.id }}
    >
      <PublicationFields
        status={project?.status ?? "draft"}
        slug={project?.slug ?? ""}
        slugTaken={COPY.slugTaken}
      >
        <SelectField
          name="domain"
          label={ENTRIES.domain}
          initial={project?.domain ?? "web"}
          options={DOMAIN_OPTIONS}
        />
        <CheckboxField
          name="featured"
          label={COPY.featured}
          hint={COPY.featuredHint}
          initial={project?.featured ?? false}
        />
      </PublicationFields>
      <FormSection title={COPY.presentation}>
        <MediaField
          name="coverMediaId"
          label={COPY.cover}
          initial={project?.coverMediaId ?? null}
          options={media}
        />
        <BilingualFields
          fields={PRESENTATION}
          translations={project?.translations}
        />
      </FormSection>
      <FormSection title={COPY.linksAndDates}>
        <div className="grid gap-6 md:grid-cols-2">
          <UrlField
            name="repoUrl"
            label={COPY.repoUrl}
            initial={project?.repoUrl ?? null}
          />
          <UrlField
            name="demoUrl"
            label={COPY.demoUrl}
            initial={project?.demoUrl ?? null}
          />
        </div>
        <DateFields
          start={{ initial: project?.startedOn ?? null, isRequired: false }}
          end={{
            initial: project?.endedOn ?? null,
            invalid: COPY.endedOnInvalid,
          }}
        />
      </FormSection>
      <SkillPicker
        name="skills"
        skills={skills}
        initial={project?.skills ?? []}
      />
    </ContentForm>
  );
}
