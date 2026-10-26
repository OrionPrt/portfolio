import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { ok } from "@/lib/result";

import { createAdmin } from "../../../test/auth";
import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createInboxRepository } from "./inbox-repository";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
});

const MISSING_ID = "00000000-0000-4000-8000-000000000000";

/** A stored message, `minutesAgo` old; returns its id. */
async function message(
  subject: string,
  { minutesAgo = 0, status = "unread" } = {},
): Promise<string> {
  const [row] = await testDb.query<{ id: string }>(
    `insert into contact_messages (name, email, subject, body, locale, status, ip_hash, created_at)
     values ('Ada', 'ada@example.com', '${subject}', 'Bonjour ${subject}', 'fr', '${status}', '${"b".repeat(64)}', now() - interval '${String(minutesAgo)} minutes')
     returning id`,
  );
  if (row === undefined) {
    throw new Error("No message");
  }
  return row.id;
}

describe("inbox repository", () => {
  it("lists received messages newest first, archived ones apart, with their total", async () => {
    await message("old", { minutesAgo: 30, status: "read" });
    await message("new", { minutesAgo: 1 });
    await message("filed", { minutesAgo: 5, status: "archived" });
    const inbox = createInboxRepository(testDb.db);

    const received = await inbox.list({
      view: "received",
      limit: 20,
      offset: 0,
    });
    expect(received).toMatchObject(
      ok({
        total: 2,
        messages: [
          { subject: "new", status: "unread", name: "Ada" },
          { subject: "old", status: "read" },
        ],
      }),
    );
    expect(
      await inbox.list({ view: "archived", limit: 20, offset: 0 }),
    ).toMatchObject(ok({ total: 1, messages: [{ subject: "filed" }] }));
  });

  it("pages through the list", async () => {
    for (let index = 0; index < 5; index++) {
      await message(`m${String(index)}`, { minutesAgo: index });
    }

    const page = await createInboxRepository(testDb.db).list({
      view: "received",
      limit: 2,
      offset: 2,
    });

    expect(page).toMatchObject(
      ok({ total: 5, messages: [{ subject: "m2" }, { subject: "m3" }] }),
    );
  });

  it("reads one message in full, or nothing for an unknown id", async () => {
    const id = await message("hello");
    const inbox = createInboxRepository(testDb.db);

    expect(await inbox.find(id)).toMatchObject(
      ok({
        id,
        subject: "hello",
        body: "Bonjour hello",
        email: "ada@example.com",
        locale: "fr",
        status: "unread",
      }),
    );
    expect(await inbox.find(MISSING_ID)).toEqual(ok(undefined));
  });

  it("counts the unread messages", async () => {
    await message("a");
    await message("b");
    await message("c", { status: "read" });

    expect(await createInboxRepository(testDb.db).countUnread()).toEqual(ok(2));
  });

  it("changes a status, and says whether the message existed", async () => {
    const id = await message("hello");
    const inbox = createInboxRepository(testDb.db);

    expect(await inbox.setStatus(id, "archived")).toEqual(ok(true));
    expect(await inbox.find(id)).toMatchObject(ok({ status: "archived" }));
    expect(await inbox.setStatus(MISSING_ID, "read")).toEqual(ok(false));
  });

  it("marks a message read only when it is unread: an archived one stays filed", async () => {
    const unread = await message("unread");
    const archived = await message("archived", { status: "archived" });
    const inbox = createInboxRepository(testDb.db);

    await inbox.markRead(unread);
    await inbox.markRead(archived);

    expect(await inbox.find(unread)).toMatchObject(ok({ status: "read" }));
    expect(await inbox.find(archived)).toMatchObject(
      ok({ status: "archived" }),
    );
  });

  it("deletes a message and audits it at once, its id only", async () => {
    const admin = await createAdmin(testDb.db);
    const id = await message("hello");
    const inbox = createInboxRepository(testDb.db);
    const actor = {
      actorId: admin.id,
      ipHash: "c".repeat(64),
      userAgent: "Firefox",
    };

    expect(await inbox.deleteAudited(id, actor)).toEqual(ok(true));
    expect(await inbox.find(id)).toEqual(ok(undefined));
    expect(
      await testDb.query(
        "select actor_id, action, entity, entity_id, diff, ip_hash, user_agent from audit_logs",
      ),
    ).toEqual([
      {
        actor_id: admin.id,
        action: "contact.message_deleted",
        entity: "contact_message",
        entity_id: id,
        diff: null,
        ip_hash: "c".repeat(64),
        user_agent: "Firefox",
      },
    ]);

    // Already gone: nothing deleted, nothing audited.
    expect(await inbox.deleteAudited(id, actor)).toEqual(ok(false));
    expect(await testDb.query("select id from audit_logs")).toHaveLength(1);
  });

  it("deletes nothing when the audit row is refused", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const id = await message("hello");
    const inbox = createInboxRepository(testDb.db);

    // No such account: the audit row's foreign key fails, and so does the delete.
    const result = await inbox.deleteAudited(id, {
      actorId: "00000000-0000-4000-8000-000000000001",
      ipHash: null,
      userAgent: null,
    });

    expect(result.ok).toBe(false);
    expect(await inbox.find(id)).toMatchObject(ok({ subject: "hello" }));
    vi.restoreAllMocks();
  });

  it("logs a failure without the values it quotes", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    // Not a UUID: PostgreSQL's error quotes the value.
    const result = await createInboxRepository(testDb.db).find(
      "ada@example.com",
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "DB_UNAVAILABLE" },
    });
    const logged = error.mock.calls.flat().map(String).join("\n");
    expect(logged).toContain("contact.inbox_failed");
    expect(logged).not.toContain("ada@example.com");
    error.mockRestore();
  });
});
