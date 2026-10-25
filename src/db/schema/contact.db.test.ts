import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { contactMessages } from "./index";

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
  body: "Bonjour, j'ai un projet.",
  locale: "fr" as const,
  ipHash: "a".repeat(64),
  userAgent: "Mozilla/5.0",
};

async function expectRefusedBy(write: Promise<unknown>, constraint: string) {
  await expect(write).rejects.toMatchObject({ cause: { constraint } });
}

describe("contact_messages", () => {
  it("stores a message as unread, with its creation time", async () => {
    const [row] = await testDb.db
      .insert(contactMessages)
      .values(MESSAGE)
      .returning();

    expect(row).toMatchObject({ ...MESSAGE, status: "unread" });
    expect(row?.createdAt).toBeInstanceOf(Date);
  });

  it.each([
    ["name", "a".repeat(101), "contact_messages_name_length"],
    [
      "email",
      `${"a".repeat(250)}@example.com`,
      "contact_messages_email_length",
    ],
    ["subject", "a".repeat(151), "contact_messages_subject_length"],
    ["body", "a".repeat(5001), "contact_messages_body_length"],
    ["userAgent", "a".repeat(513), "contact_messages_user_agent_length"],
    // Only a hash is ever stored, never an address.
    ["ipHash", "203.0.113.7", "contact_messages_ip_hash_format"],
  ])("refuses a %s that breaks its limit", async (field, value, constraint) => {
    await expectRefusedBy(
      testDb.db.insert(contactMessages).values({ ...MESSAGE, [field]: value }),
      constraint,
    );
  });
});
