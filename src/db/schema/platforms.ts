import { sql } from "drizzle-orm";
import { check, date, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { httpsOrNull, timestamps } from "./columns";

/**
 * Where I train (Hack The Box, Root Me, a CTF…), entered by hand in the
 * admin: no platform is called (ADR-0009). Names are proper nouns, never
 * translated; so are ranks.
 */
export const platforms = pgTable(
  "platforms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    profileUrl: text("profile_url"),
    rank: text("rank"),
    points: integer("points"),
    /** The day the rank and points were read on the platform. */
    updatedOn: date("updated_on", { mode: "string" }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check("platforms_profile_url_https", httpsOrNull(t.profileUrl)),
    check(
      "platforms_points_positive",
      sql`${t.points} is null or ${t.points} >= 0`,
    ),
  ],
);
