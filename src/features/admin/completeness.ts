/**
 * How far a translation goes: complete when every required field holds text,
 * missing when no field does (the site then shows the default language).
 */
export type TranslationState = "complete" | "partial" | "missing";

type TranslationValues = Readonly<Record<string, string | null | undefined>>;

function hasText(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim() !== "";
}

export function translationState(
  values: TranslationValues | undefined,
  required: readonly string[],
): TranslationState {
  if (values === undefined || !Object.values(values).some(hasText)) {
    return "missing";
  }
  return required.every((field) => hasText(values[field]))
    ? "complete"
    : "partial";
}

interface TranslatedFields {
  readonly required: readonly string[];
  /** Wanted in a translation once the default language fills them in. */
  readonly optional: readonly string[];
}

/**
 * How far a translation goes, measured against the default language's: its
 * required fields, and the optional ones the default language fills in. Where
 * nothing is wanted, nothing is missing.
 */
export function translationStateAgainst(
  values: TranslationValues | undefined,
  reference: TranslationValues | undefined,
  { required, optional }: TranslatedFields,
): TranslationState {
  const wanted = [
    ...required,
    ...optional.filter((field) => hasText(reference?.[field])),
  ];
  return wanted.length === 0 ? "complete" : translationState(values, wanted);
}
