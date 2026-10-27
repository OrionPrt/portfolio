import type { z } from "zod";

import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locales";

/** A form's text values by name; files are left out, and so are repeated names. */
export function textFields(
  formData: FormData,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    [...formData.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

/** Every text sent under one name, in order: an ordered list (linked skills). */
export function textList(formData: FormData, name: string): readonly string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string");
}

/** An optional single field: blank reads as null, as the schemas expect. */
export function blankToNull(value: string | undefined): string | null {
  return value === undefined || value.trim() === "" ? null : value;
}

/**
 * Each locale's fields, named `<locale>.<key>` in the form. A blank optional
 * field reads as null. Another locale left blank is left out, so the site
 * falls back to the default one; the default locale is always there, so its
 * missing fields report themselves.
 */
export function translationsFrom<K extends string>(
  fields: Readonly<Record<string, string>>,
  keys: readonly K[],
  { optional = [] }: { readonly optional?: readonly K[] } = {},
): Partial<Record<Locale, Record<K, string | null>>> {
  const valueOf = (locale: Locale, key: K) => fields[`${locale}.${key}`] ?? "";
  return Object.fromEntries(
    LOCALES.flatMap((locale) => {
      const isBlank = keys.every((key) => valueOf(locale, key).trim() === "");
      if (locale !== DEFAULT_LOCALE && isBlank) {
        return [];
      }
      const values = Object.fromEntries(
        keys.map((key) => {
          const value = valueOf(locale, key);
          return [
            key,
            optional.includes(key) && value.trim() === "" ? null : value,
          ];
        }),
      );
      return [[locale, values]];
    }),
  );
}

/** What a form shows next to a field: the words come from the field. */
export type FieldProblem =
  | { readonly problem: "required" }
  | { readonly problem: "too_long"; readonly max: number }
  | { readonly problem: "invalid" }
  /** Another entry holds this value (a slug, a link's kind). */
  | { readonly problem: "taken" };

function problemOf(issue: z.core.$ZodIssue): FieldProblem {
  switch (issue.code) {
    case "too_small":
    case "invalid_type":
      return { problem: "required" };
    case "too_big":
      return { problem: "too_long", max: Number(issue.maximum) };
    case "custom":
      // A missing default-locale translation: its fields are required.
      return issue.path[0] === "translations"
        ? { problem: "required" }
        : { problem: "invalid" };
    default:
      return { problem: "invalid" };
  }
}

/**
 * Zod's issues by field, as the form names them: `translations.en.headline`
 * becomes `en.headline`. The first problem of a field is the one shown.
 */
export function fieldProblemsOf(
  error: z.ZodError,
): Readonly<Record<string, FieldProblem>> {
  return error.issues.reduce<Readonly<Record<string, FieldProblem>>>(
    (problems, issue) => {
      const path =
        issue.path[0] === "translations" ? issue.path.slice(1) : issue.path;
      const key = path.map(String).join(".");
      return key in problems
        ? problems
        : { ...problems, [key]: problemOf(issue) };
    },
    {},
  );
}
