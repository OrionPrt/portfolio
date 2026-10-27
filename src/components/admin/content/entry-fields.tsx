import type { ReactNode } from "react";

import { TEXT_LIMITS } from "@/features/content/limits";
import {
  CONTENT_STATUSES,
  type ContentStatus,
} from "@/features/content/vocabulary";
import { LOCALES, type Locale } from "@/i18n/locales";
import { MAX_SLUG_LENGTH } from "@/lib/slug";

import { ADMIN_COPY } from "../copy";
import { BilingualField, type BilingualKind } from "./bilingual-field";
import { SelectField } from "./choice-fields";
import { TextField } from "./text-field";

// The parts the project and experience forms share: entries with a page of
// their own, a status, dates, and a summary in two languages.

const COPY = ADMIN_COPY.entries;

const STATUS_OPTIONS = CONTENT_STATUSES.map(
  (status) => [status, COPY.statuses[status]] as const,
);

interface FormSectionProps {
  readonly title: string;
  readonly children: ReactNode;
}

/** A part of a long form, named for those who move from group to group. */
export function FormSection({ title, children }: FormSectionProps) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-6">
      <legend className="mb-4 text-lg font-semibold tracking-tight">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

interface PublicationFieldsProps {
  readonly status: ContentStatus;
  readonly slug: string;
  /** "Ce slug est déjà pris par un autre projet." */
  readonly slugTaken: string;
  /** The entry's own choices: its domain, whether it is featured. */
  readonly children?: ReactNode;
}

export function PublicationFields({
  status,
  slug,
  slugTaken,
  children,
}: PublicationFieldsProps) {
  return (
    <FormSection title={COPY.publication}>
      <div className="grid gap-6 md:grid-cols-2">
        <SelectField
          name="status"
          label={COPY.status}
          hint={COPY.statusHint}
          initial={status}
          options={STATUS_OPTIONS}
        />
        <TextField
          name="slug"
          label={COPY.slug}
          hint={COPY.slugHint}
          invalidMessage={COPY.slugInvalid}
          takenMessage={slugTaken}
          initial={slug}
          maxLength={MAX_SLUG_LENGTH}
          isRequired
        />
      </div>
      {children}
    </FormSection>
  );
}

interface DateFieldsProps {
  readonly startedOn: string | null;
  readonly endedOn: string | null;
  readonly isStartRequired: boolean;
  readonly endHint?: string;
  /** Why the end was refused: it precedes the start (or comes without one). */
  readonly endInvalid: string;
}

export function DateFields({
  startedOn,
  endedOn,
  isStartRequired,
  endHint = COPY.optional,
  endInvalid,
}: DateFieldsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <TextField
        name="startedOn"
        type="date"
        label={COPY.startedOn}
        hint={isStartRequired ? undefined : COPY.optional}
        initial={startedOn ?? ""}
        isRequired={isStartRequired}
      />
      <TextField
        name="endedOn"
        type="date"
        label={COPY.endedOn}
        hint={endHint}
        invalidMessage={endInvalid}
        initial={endedOn ?? ""}
      />
    </div>
  );
}

interface UrlFieldProps {
  readonly name: string;
  readonly label: string;
  readonly initial: string | null;
}

/** An optional https link. */
export function UrlField({ name, label, initial }: UrlFieldProps) {
  return (
    <TextField
      name={name}
      type="url"
      label={label}
      hint={COPY.urlHint}
      invalidMessage={COPY.urlInvalid}
      initial={initial ?? ""}
      maxLength={TEXT_LIMITS.url}
    />
  );
}

/** A field written in each language: its label, size and kind. */
export interface TranslatedField<K extends string> {
  readonly name: K;
  readonly label: string;
  readonly maxLength: number;
  readonly kind?: BilingualKind;
  readonly hint?: string;
  readonly isRequired?: boolean;
}

/** The summary in three steps, then the part for engineers. */
export const SUMMARY_FIELDS = [
  {
    name: "summaryContext",
    label: COPY.summaryContext,
    kind: "multiline",
    maxLength: TEXT_LIMITS.summary,
    isRequired: true,
  },
  {
    name: "summaryAction",
    label: COPY.summaryAction,
    kind: "multiline",
    maxLength: TEXT_LIMITS.summary,
    isRequired: true,
  },
  {
    name: "summaryResult",
    label: COPY.summaryResult,
    kind: "multiline",
    maxLength: TEXT_LIMITS.summary,
    isRequired: true,
  },
  {
    name: "technicalMd",
    label: COPY.technicalMd,
    hint: COPY.technicalHint,
    kind: "markdown",
    maxLength: TEXT_LIMITS.markdown,
  },
] as const satisfies readonly TranslatedField<string>[];

type Translations<K extends string> = Partial<
  Record<Locale, Readonly<Record<K, string | null>> | undefined>
>;

interface BilingualFieldsProps<K extends string> {
  readonly fields: readonly TranslatedField<K>[];
  /** The stored languages; undefined for a new entry. */
  readonly translations: Translations<K> | undefined;
}

/** Each field in both languages, in the order given. */
export function BilingualFields<K extends string>({
  fields,
  translations,
}: BilingualFieldsProps<K>) {
  return fields.map((field) => (
    <BilingualField
      key={field.name}
      {...field}
      initial={Object.fromEntries(
        LOCALES.map((locale) => [
          locale,
          translations?.[locale]?.[field.name] ?? "",
        ]),
      )}
    />
  ));
}
