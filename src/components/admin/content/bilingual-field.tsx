"use client";

import { useId, useState } from "react";

import { FormField, type ControlProps } from "@/components/ui/form-field";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locales";

import { ADMIN_COPY } from "../copy";
import { useField } from "./content-form";
import { messageOf } from "./field-message";
import { MarkdownEditor } from "./markdown-editor";

const COPY = ADMIN_COPY.content;

export type BilingualKind = "text" | "multiline" | "markdown";

interface LocaleLabelProps {
  readonly locale: Locale;
  readonly showsToTranslate: boolean;
}

/** "Anglais À traduire": the space between them keeps the name readable. */
function LocaleLabel({ locale, showsToTranslate }: LocaleLabelProps) {
  return (
    <span className="flex items-center gap-2">
      {COPY.locales[locale]}{" "}
      {showsToTranslate && (
        <span className="bg-signal/15 text-fg rounded-chip px-1.5 font-mono text-xs">
          {COPY.toTranslate}
        </span>
      )}
    </span>
  );
}

interface LocaleControlProps {
  readonly name: string;
  readonly locale: Locale;
  readonly initial: string;
  readonly kind: BilingualKind;
  readonly isRequired: boolean;
  readonly maxLength: number | undefined;
  readonly showsToTranslate: boolean;
  readonly onText: (text: string) => void;
}

function LocaleControl(props: LocaleControlProps) {
  const { name, locale, kind, maxLength, onText } = props;
  const id = useId();
  const fieldName = `${locale}.${name}`;
  const { value, problem } = useField(fieldName, props.initial);
  // The other locale may stay empty: the site falls back to the default.
  const isRequired = props.isRequired && locale === DEFAULT_LOCALE;
  const plain = (control: ControlProps) => {
    const shared = {
      ...control,
      name: fieldName,
      lang: locale,
      defaultValue: value,
      required: isRequired,
      maxLength,
      onInput: (event: { currentTarget: { value: string } }) => {
        onText(event.currentTarget.value);
      },
    };
    return kind === "multiline" ? (
      <textarea {...shared} rows={4} />
    ) : (
      <input {...shared} type="text" autoComplete="off" />
    );
  };
  return (
    <FormField
      id={id}
      label={
        <LocaleLabel
          locale={locale}
          showsToTranslate={props.showsToTranslate}
        />
      }
      error={messageOf(problem)}
    >
      {(control) =>
        kind === "markdown" ? (
          <MarkdownEditor
            control={control}
            name={fieldName}
            initial={value}
            lang={locale}
            isRequired={isRequired}
            context={COPY.locales[locale].toLowerCase()}
            onText={onText}
          />
        ) : (
          plain(control)
        )
      }
    </FormField>
  );
}

interface BilingualFieldProps {
  /** The field's key: its controls are named `fr.<name>` and `en.<name>`. */
  readonly name: string;
  readonly label: string;
  readonly initial: Partial<Record<Locale, string | null>>;
  readonly kind?: BilingualKind;
  /** Required in the default language; the other falls back to it. */
  readonly isRequired?: boolean;
  readonly maxLength?: number;
  readonly hint?: string;
}

/**
 * One field in both languages, side by side, each control in its own
 * language. A translation still to write is flagged as the text is typed.
 */
export function BilingualField({
  name,
  label,
  initial,
  kind = "text",
  isRequired = false,
  maxLength,
  hint,
}: BilingualFieldProps) {
  const hintId = useId();
  // What the controls start from: after a refusal, what was sent.
  const french = useField(`fr.${name}`, initial.fr ?? "").value;
  const english = useField(`en.${name}`, initial.en ?? "").value;
  // Whether each language is blank: a boolean, so typing re-renders only on a change.
  const [isBlank, setBlank] = useState<Record<Locale, boolean>>(() => ({
    fr: french.trim() === "",
    en: english.trim() === "",
  }));
  return (
    <fieldset
      aria-describedby={hint === undefined ? undefined : hintId}
      className="flex flex-col gap-3"
    >
      <legend className="mb-1 text-sm font-semibold">{label}</legend>
      {hint !== undefined && (
        <p id={hintId} className="text-fg-muted text-xs">
          {hint}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {LOCALES.map((locale) => (
          <LocaleControl
            key={locale}
            name={name}
            locale={locale}
            initial={initial[locale] ?? ""}
            kind={kind}
            isRequired={isRequired}
            maxLength={maxLength}
            showsToTranslate={
              locale !== DEFAULT_LOCALE &&
              isBlank[locale] &&
              !isBlank[DEFAULT_LOCALE]
            }
            onText={(text) => {
              const blank = text.trim() === "";
              setBlank((current) =>
                current[locale] === blank
                  ? current
                  : { ...current, [locale]: blank },
              );
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
