import { describe, expect, it, vi } from "vitest";

import { err, ok } from "@/lib/result";

const mocks = vi.hoisted(() => ({ countUnread: vi.fn() }));

vi.mock("@/db/client", () => ({
  withDatabase: (read: (db: unknown) => unknown) => read({}),
}));
vi.mock("./inbox-repository", () => ({
  createInboxRepository: () => ({ countUnread: mocks.countUnread }),
}));

import { getUnreadCount } from "./inbox-queries";

describe("getUnreadCount", () => {
  it("counts the unread messages, or says nothing when the database cannot", async () => {
    mocks.countUnread.mockResolvedValueOnce(ok(4));
    expect(await getUnreadCount()).toBe(4);

    mocks.countUnread.mockResolvedValueOnce(
      err({ code: "DB_UNAVAILABLE", message: "down" }),
    );
    expect(await getUnreadCount()).toBeUndefined();
  });
});
