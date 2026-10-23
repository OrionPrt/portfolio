import { countPlaceholders, PLACEHOLDER } from "@/db/seed/placeholders";
import { parseSeedContent } from "@/db/seed/schema";
import { seedDatabase } from "@/db/seed/seed";

import { fail, runWithDatabase } from "../db/connect";
import { SEED_CONTENT } from "./content";

/** Validates the content first: an invalid file never opens a connection. */
async function main(): Promise<void> {
  const parsed = parseSeedContent(SEED_CONTENT);
  if (!parsed.ok) {
    fail(`db:seed: invalid content\n  ${parsed.error.issues.join("\n  ")}`);
    return;
  }
  const content = parsed.data;
  const placeholders = countPlaceholders(content);
  if (placeholders > 0) {
    process.stderr.write(
      `db:seed: warning: ${String(placeholders)} "${PLACEHOLDER}" placeholders remain, and show on the site.\n`,
    );
  }
  await runWithDatabase("db:seed", async (db) => {
    await seedDatabase(db, content);
    return `upserted (skills: ${String(content.skills.length)}, projects: ${String(content.projects.length)}, tiles: ${String(content.tiles.length)}).`;
  });
}

void main();
