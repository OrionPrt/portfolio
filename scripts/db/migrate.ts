import path from "node:path";

import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { runWithDatabase } from "./connect";

// pnpm runs scripts from the repository root.
const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

/** Applies the pending migrations of drizzle/ in one transaction. */
async function main(): Promise<void> {
  await runWithDatabase("db:migrate", async (db) => {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    return "the database schema is up to date.";
  });
}

void main();
