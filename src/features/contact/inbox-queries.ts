import "server-only";

import { cache } from "react";

import { withDatabase } from "@/db/client";

import { createInboxRepository } from "./inbox-repository";

/**
 * Unread messages, for the navigation's badge and the dashboard: read once per
 * request (React cache). Undefined when the database cannot say.
 */
export const getUnreadCount = cache(async (): Promise<number | undefined> => {
  const counted = await withDatabase((db) =>
    createInboxRepository(db).countUnread(),
  );
  return counted.ok ? counted.data : undefined;
});
