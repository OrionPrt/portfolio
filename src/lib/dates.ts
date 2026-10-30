/**
 * Stored dates are calendar days ("2024-03-01"), not instants. Read as
 * midnight UTC and formatted with `timeZone: "UTC"`, they never shift a day.
 */
export function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

/** Month and year of a stored date, in the reader's language. */
export const MONTH_YEAR = {
  year: "numeric",
  month: "long",
  timeZone: "UTC",
} as const satisfies Intl.DateTimeFormatOptions;

/** The year alone: where a month would not fit (a tile). */
export const YEAR = {
  year: "numeric",
  timeZone: "UTC",
} as const satisfies Intl.DateTimeFormatOptions;
