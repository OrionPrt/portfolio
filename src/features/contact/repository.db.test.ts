import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createContactRepository } from "./repository";

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

const MESSAGE = {
  name: "Ada",
  email: "ada@example.com",
  subject: "Une mission",
  message: "Bonjour, j'ai un projet.",
  locale: "en" as const,
  ipHash: "b".repeat(64),
  userAgent: "Mozilla/5.0",
};

describe("createContactRepository", () => {
  it("stores a message as unread", async () => {
    const result = await createContactRepository(testDb.db).create(MESSAGE);

    expect(result).toEqual({ ok: true, data: undefined });
    expect(
      await testDb.query(
        "select name, email, subject, body, locale, status, ip_hash, user_agent from contact_messages",
      ),
    ).toEqual([
      {
        name: "Ada",
        email: "ada@example.com",
        subject: "Une mission",
        body: "Bonjour, j'ai un projet.",
        locale: "en",
        status: "unread",
        ip_hash: "b".repeat(64),
        user_agent: "Mozilla/5.0",
      },
    ]);
  });

  it("fails as DB_UNAVAILABLE when the row is refused, and logs none of it", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await createContactRepository(testDb.db).create({
      ...MESSAGE,
      message: "Un message très personnel.",
      ipHash: "203.0.113.7",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "DB_UNAVAILABLE" },
    });
    const logged = consoleError.mock.calls.flat().map(String).join("\n");
    expect(logged).toContain("contact.create_failed");
    expect(logged).not.toContain("très personnel");
    expect(logged).not.toContain("ada@example.com");
    expect(logged).not.toContain("203.0.113.7");
    vi.restoreAllMocks();
  });
});
