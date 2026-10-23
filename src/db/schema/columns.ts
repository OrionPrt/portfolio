import { sql, type SQL } from "drizzle-orm";
import { timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";

import { MAX_SLUG_LENGTH, SLUG_PATTERN } from "@/lib/slug";

/**
 * created_at / updated_at. Drizzle sets updated_at on every update, upserts
 * included, from the database clock. A re-seed bumps it even when nothing
 * changed: it means "last written", not "last edited".
 */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
};

// CHECK constraints are DDL: they cannot take bound parameters, so the constant
// patterns below are inlined with sql.raw. They are never built from user input.

export function slugFormat(column: AnyPgColumn): SQL {
  return sql`${column} ~ ${sql.raw(`'${SLUG_PATTERN}'`)} and char_length(${column}) <= ${sql.raw(String(MAX_SLUG_LENGTH))}`;
}

// A host and no whitespace after the scheme: no bare "https://", no line break.
const HTTPS_URL_PATTERN = "^https://[^[:space:]]+$";
const MAILTO_URL_PATTERN = "^mailto:[^[:space:]@]+@[^[:space:]@]+$";

/** Links rendered in `href` must be https: blocks javascript: and data: URLs at the source. */
export function httpsUrl(column: AnyPgColumn): SQL {
  return sql`${column} ~ ${sql.raw(`'${HTTPS_URL_PATTERN}'`)}`;
}

export function mailtoUrl(column: AnyPgColumn): SQL {
  return sql`${column} ~ ${sql.raw(`'${MAILTO_URL_PATTERN}'`)}`;
}

export function httpsOrNull(column: AnyPgColumn): SQL {
  return sql`${column} is null or ${httpsUrl(column)}`;
}

/** An end date needs a start date, and cannot precede it. */
export function endsAfterStart(
  startedOn: AnyPgColumn,
  endedOn: AnyPgColumn,
): SQL {
  return sql`${endedOn} is null or (${startedOn} is not null and ${endedOn} >= ${startedOn})`;
}
