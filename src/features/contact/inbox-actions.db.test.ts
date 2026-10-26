import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { err, ok } from "@/lib/result";

import { createAdmin } from "../../../test/auth";
import { createTestDatabase, type TestDatabase } from "../../../test/db";

let testDb: TestDatabase;

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  checkedRequest: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/features/auth/dal", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/features/auth/checked-request", () => ({
  checkedRequest: mocks.checkedRequest,
}));
vi.mock("@/db/client", () => ({
  withDatabase: (run: (db: unknown) => unknown) => run(testDb.db),
}));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

import {
  deleteMessageAction,
  markMessageReadAction,
  setMessageStatusAction,
} from "./inbox-actions";
import { INBOX_IDLE } from "./inbox-state";

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

const CONTEXT = { networkHash: "c".repeat(64), userAgent: "Firefox" };

beforeEach(async () => {
  await testDb.reset();
  vi.clearAllMocks();
  const admin = await createAdmin(testDb.db);
  mocks.requireAdmin.mockResolvedValue({
    sessionId: "a".repeat(64),
    stage: "signed_in",
    expiresAt: new Date(),
    user: { id: admin.id, email: admin.email },
  });
  mocks.checkedRequest.mockResolvedValue(ok({ config: {}, context: CONTEXT }));
});

async function message(status = "unread"): Promise<string> {
  const [row] = await testDb.query<{ id: string }>(
    `insert into contact_messages (name, email, subject, body, locale, status, ip_hash)
     values ('Ada', 'ada@example.com', 'Une mission', 'Un message très personnel', 'fr', '${status}', '${"b".repeat(64)}')
     returning id`,
  );
  if (row === undefined) {
    throw new Error("No message");
  }
  return row.id;
}

async function statusOf(id: string): Promise<string | undefined> {
  const [row] = await testDb.query<{ status: string }>(
    `select status from contact_messages where id = '${id}'`,
  );
  return row?.status;
}

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.append(name, value);
  }
  return data;
}

describe("inbox actions", () => {
  it("refuse anyone without a full session, before touching a message", async () => {
    const id = await message();
    mocks.requireAdmin.mockRejectedValue(new Error("redirect:/admin/login"));

    await expect(markMessageReadAction(id)).rejects.toThrow("redirect:");
    await expect(
      setMessageStatusAction(INBOX_IDLE, form({ id, status: "archived" })),
    ).rejects.toThrow("redirect:");
    await expect(deleteMessageAction(INBOX_IDLE, form({ id }))).rejects.toThrow(
      "redirect:",
    );
    expect(await statusOf(id)).toBe("unread");
  });

  it("change a message's status, and refresh the page", async () => {
    const id = await message();

    expect(
      await setMessageStatusAction(
        INBOX_IDLE,
        form({ id, status: "archived" }),
      ),
    ).toEqual({ status: "changed", to: "archived" });
    expect(await statusOf(id)).toBe("archived");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it.each([
    [{ id: "not-an-id", status: "read" }],
    [{ id: "00000000-0000-4000-8000-000000000000", status: "read" }],
    [{ id: "", status: "spam" }],
  ])("answer not found for %j, writing nothing", async (fields) => {
    const id = await message();

    expect(await setMessageStatusAction(INBOX_IDLE, form(fields))).toEqual({
      status: "not_found",
    });
    expect(await statusOf(id)).toBe("unread");
  });

  it("report an outage", async () => {
    const id = await message();
    mocks.checkedRequest.mockResolvedValue(err("unavailable"));

    expect(
      await setMessageStatusAction(INBOX_IDLE, form({ id, status: "read" })),
    ).toEqual({ status: "unavailable" });
    expect(await deleteMessageAction(INBOX_IDLE, form({ id }))).toEqual({
      status: "unavailable",
    });
    expect(await statusOf(id)).toBe("unread");
  });

  it("mark a message read once opened, unless it was archived", async () => {
    const unread = await message();
    const archived = await message("archived");

    await markMessageReadAction(unread);
    await markMessageReadAction(archived);
    await markMessageReadAction("not-an-id");

    expect(await statusOf(unread)).toBe("read");
    expect(await statusOf(archived)).toBe("archived");
  });

  it("delete a message, audit its id only, and go back to the inbox", async () => {
    const id = await message();

    await expect(deleteMessageAction(INBOX_IDLE, form({ id }))).rejects.toThrow(
      "redirect:/admin/messages",
    );

    expect(await statusOf(id)).toBeUndefined();
    const audit = await testDb.query<Record<string, unknown>>(
      "select action, entity, entity_id, diff, ip_hash from audit_logs",
    );
    expect(audit).toEqual([
      {
        action: "contact.message_deleted",
        entity: "contact_message",
        entity_id: id,
        diff: null,
        ip_hash: CONTEXT.networkHash,
      },
    ]);
    expect(JSON.stringify(audit)).not.toContain("personnel");
  });

  it("answer not found for a message already deleted", async () => {
    expect(
      await deleteMessageAction(
        INBOX_IDLE,
        form({ id: "00000000-0000-4000-8000-000000000000" }),
      ),
    ).toEqual({ status: "not_found" });
    expect(await testDb.query("select id from audit_logs")).toEqual([]);
  });
});
