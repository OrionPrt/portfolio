import { unlockAll } from "@/features/auth/admin-cli";

import { runWithDatabase } from "../db/connect";

/** Lifts every sign-in lock, of every network (there is one account). */
async function main(): Promise<void> {
  await runWithDatabase("admin:unlock", async ({ db }) => {
    const cleared = await unlockAll(db);
    if (!cleared.ok) {
      throw new Error("the database could not be written.");
    }
    return `${String(cleared.data)} lock or count cleared.`;
  });
}

void main();
