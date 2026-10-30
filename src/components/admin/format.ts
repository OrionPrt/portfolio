import { DAY_MONTH_YEAR, MONTH_YEAR, utcDate } from "@/lib/dates";

import { ADMIN_COPY } from "./copy";

const PARIS = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export function formatParisDateTime(date: Date): string {
  return PARIS.format(date);
}

const MONTH = new Intl.DateTimeFormat("fr-FR", MONTH_YEAR);

/** "janvier 2024", for a stored calendar day. */
export function formatMonthYear(isoDate: string): string {
  return MONTH.format(utcDate(isoDate));
}

/** "janvier 2024 – aujourd'hui" while under way (no end). */
export function formatPeriod(start: string, end: string | null): string {
  return ADMIN_COPY.entries.period(
    formatMonthYear(start),
    end === null ? undefined : formatMonthYear(end),
  );
}

const DAY = new Intl.DateTimeFormat("fr-FR", DAY_MONTH_YEAR);

/** "30 octobre 2026", for a stored calendar day. */
export function formatDay(isoDate: string): string {
  return DAY.format(utcDate(isoDate));
}

const NUMBER = new Intl.NumberFormat("fr-FR");

/** "12 500", grouped as French writes it. */
export function formatNumber(value: number): string {
  return NUMBER.format(value);
}

// Order matters: Edge and Chrome both say "Safari", Edge also says "Chrome".
const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg\//, "Edge"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/Android/, "Android"],
  [/iPhone|iPad/, "iOS"],
  [/Windows/, "Windows"],
  [/Mac OS X/, "macOS"],
  [/Linux/, "Linux"],
];

/** "Firefox · Linux": enough to tell one's own devices apart; undefined otherwise. */
export function describeUserAgent(
  userAgent: string | null,
): string | undefined {
  if (userAgent === null) {
    return undefined;
  }
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  return browser !== undefined && system !== undefined
    ? `${browser} · ${system}`
    : undefined;
}
