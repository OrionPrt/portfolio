import { DEFAULT_LOCALE, type Locale } from "@/i18n/locales";
import { logger } from "@/lib/logger";
import { err, ok, type AppError, type Result } from "@/lib/result";

import { MAX_OFFSET, MAX_PAGE_SIZE } from "./limits";

/** What callers see of any database failure: the cause is logged, never returned. */
export const DB_UNAVAILABLE: AppError = {
  code: "DB_UNAVAILABLE",
  message: "The database could not be reached.",
};

const DEFAULT_PAGE_SIZE = 20;

export interface PageRequest {
  readonly limit?: number;
  readonly offset?: number;
}

export interface Page {
  readonly limit: number;
  readonly offset: number;
}

function wholeNumber(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback;
}

/** Every list is bounded: no query ever runs without a LIMIT. */
export function toPage(request: PageRequest = {}): Page {
  const limit = wholeNumber(request.limit, DEFAULT_PAGE_SIZE);
  const offset = wholeNumber(request.offset, 0);
  return {
    limit: Math.min(Math.max(limit, 1), MAX_PAGE_SIZE),
    offset: Math.min(Math.max(offset, 0), MAX_OFFSET),
  };
}

export interface Localized<T> {
  readonly value: T;
  /** True when the requested locale was missing and another one was used. */
  readonly isFallback: boolean;
}

/** The requested translation, else the default locale's, else any. */
export function pickTranslation<T extends { readonly locale: Locale }>(
  translations: readonly T[],
  locale: Locale,
): Localized<T> | undefined {
  const exact = translations.find((t) => t.locale === locale);
  if (exact !== undefined) {
    return { value: exact, isFallback: false };
  }
  const fallback =
    translations.find((t) => t.locale === DEFAULT_LOCALE) ?? translations[0];
  return fallback === undefined
    ? undefined
    : { value: fallback, isFallback: true };
}

interface RunQueryOptions {
  /**
   * The query's values are personal data. Drizzle quotes them in its error,
   * and Postgres repeats a refused row in its detail: only what identifies the
   * failure is logged then.
   */
  readonly hasPersonalData?: boolean;
}

/** Fields of a driver error (postgres.js, Neon) that never hold a value. */
const FAILURE_FIELDS: ReadonlySet<string> = new Set([
  "code",
  "constraint",
  "constraint_name",
  "table",
  "table_name",
  "column",
  "column_name",
]);

/** An error reduced to its kind and SQL diagnostics: no message, query or values. */
function failureOf(error: unknown): Readonly<Record<string, string>> {
  const source = error instanceof Error ? (error.cause ?? error) : error;
  const fields =
    typeof source === "object" && source !== null
      ? Object.entries(source).filter(
          (entry): entry is [string, string] =>
            FAILURE_FIELDS.has(entry[0]) && typeof entry[1] === "string",
        )
      : [];
  return {
    kind: error instanceof Error ? error.name : typeof error,
    ...Object.fromEntries(fields),
  };
}

/**
 * Runs a query and turns a database failure into a Result. The failure is
 * logged once, with its context; callers only see a generic code and message.
 */
export async function runQuery<T>(
  event: string,
  read: () => Promise<T>,
  { hasPersonalData = false }: RunQueryOptions = {},
): Promise<Result<T>> {
  try {
    return ok(await read());
  } catch (error) {
    logger.error(
      event,
      hasPersonalData ? { failure: failureOf(error) } : { error },
    );
    return err(DB_UNAVAILABLE);
  }
}
