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

/** A full day: "30 octobre 2026". */
export const DAY_MONTH_YEAR = {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
} as const satisfies Intl.DateTimeFormatOptions;

/** The year alone: where a month would not fit (a tile). */
export const YEAR = {
  year: "numeric",
  timeZone: "UTC",
} as const satisfies Intl.DateTimeFormatOptions;

/** The site's own time zone: a day is a day in Paris. */
export const SITE_TIME_ZONE = "Europe/Paris";

/** Today's date ("2026-10-30") in the site's time zone. */
export function siteToday(now: Date = new Date()): string {
  // The Canadian English format is the ISO one: year, month, day.
  return new Intl.DateTimeFormat("en-CA", { timeZone: SITE_TIME_ZONE }).format(
    now,
  );
}
