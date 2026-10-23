import { boolean, integer, pgTable, uuid } from "drizzle-orm/pg-core";

import { tileKindEnum, tileSizeEnum } from "./enums";

/**
 * Layout of the home hub: which tiles show, in which order and size.
 * Content comes from the other tables (the featured project tile shows the
 * first featured project), so a tile never points at a row of its own.
 */
export const bentoTiles = pgTable("bento_tiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: tileKindEnum("kind").notNull().unique(),
  size: tileSizeEnum("size").notNull().default("md"),
  sortOrder: integer("sort_order").notNull().default(0),
  visible: boolean("visible").notNull().default(true),
});
