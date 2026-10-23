import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only reads the schema; migrations are applied by
// scripts/db/migrate.ts, which validates DATABASE_URL first.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
