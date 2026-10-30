import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  adminSessions,
  auditLogs,
  contactMessages,
  loginThrottles,
} from "@/db/schema";

import { createAdmin } from "../../../test/auth";
import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { purgeExpired } from "./purge-repository";

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

const NOW = new Date("2026-10-30T03:00:00Z");
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

const MESSAGE = {
  name: "Ada",
  email: "ada@example.com",
  subject: "Une mission",
  body: "Bonjour, j'ai un projet.",
  locale: "fr" as const,
  ipHash: "a".repeat(64),
};

async function remaining(table: string, column: string): Promise<string[]> {
  const rows = await testDb.query<{ value: string }>(
    `select ${column}::text as value from ${table} order by 1`,
  );
  return rows.map((row) => row.value);
}

describe("purgeExpired", () => {
  it("deletes the messages over 12 months old, keeping the others", async () => {
    await testDb.db.insert(contactMessages).values([
      { ...MESSAGE, subject: "old", createdAt: ago(366 * DAY_MS) },
      { ...MESSAGE, subject: "recent", createdAt: ago(300 * DAY_MS) },
    ]);

    const report = await purgeExpired(testDb.db, NOW);

    expect(report.messages).toBe(1);
    expect(await remaining("contact_messages", "subject")).toEqual(["recent"]);
  });

  it("deletes the sessions past their end", async () => {
    const admin = await createAdmin(testDb.db);
    await testDb.db.insert(adminSessions).values(
      [
        ["a", ago(HOUR_MS)],
        ["b", new Date(NOW.getTime() + HOUR_MS)],
      ].map(([key, expiresAt]) => ({
        id: String(key).repeat(64),
        userId: admin.id,
        stage: "signed_in" as const,
        createdAt: ago(DAY_MS),
        expiresAt: expiresAt as Date,
      })),
    );

    expect((await purgeExpired(testDb.db, NOW)).sessions).toBe(1);
    expect(await remaining("admin_sessions", "left(id, 1)")).toEqual(["b"]);
  });

  it("deletes the sign-in counts whose window has passed, never one that still locks", async () => {
    const rows = [
      // Counted over a day ago, no lock: as good as absent.
      ["a", ago(25 * HOUR_MS), null],
      // Counted over a day ago, its lock ran out.
      ["b", ago(25 * HOUR_MS), ago(HOUR_MS)],
      // Counted over a day ago, still locked: kept.
      ["c", ago(25 * HOUR_MS), new Date(NOW.getTime() + HOUR_MS)],
      // Within the longest window: kept.
      ["d", ago(23 * HOUR_MS), null],
    ] as const;
    await testDb.db.insert(loginThrottles).values(
      rows.map(([key, windowStartedAt, lockedUntil]) => ({
        key: key.repeat(64),
        scope: "account" as const,
        failures: 5,
        windowStartedAt,
        lockedUntil,
      })),
    );

    expect((await purgeExpired(testDb.db, NOW)).throttles).toBe(2);
    expect(await remaining("login_throttles", "left(key, 1)")).toEqual([
      "c",
      "d",
    ]);
  });

  it("purges the audit log of its entries over 12 months old", async () => {
    await testDb.db.insert(auditLogs).values([
      {
        action: "content.updated",
        createdAt: new Date(Date.now() - 400 * DAY_MS),
      },
      { action: "content.deleted", createdAt: new Date() },
    ]);

    expect((await purgeExpired(testDb.db, NOW)).auditLogs).toBe(1);
    // The recent entry stays, and the purge is recorded.
    expect(await remaining("audit_logs", "action")).toEqual([
      "content.deleted",
      "retention.purged",
    ]);
  });

  it("reports nothing to purge as zeros, and audits nothing then", async () => {
    expect(await purgeExpired(testDb.db, NOW)).toEqual({
      messages: 0,
      sessions: 0,
      throttles: 0,
      auditLogs: 0,
    });
    expect(await remaining("audit_logs", "action")).toEqual([]);
  });

  it("audits a purge that removed anything, its counts in one value", async () => {
    await testDb.db
      .insert(contactMessages)
      .values({ ...MESSAGE, createdAt: ago(400 * DAY_MS) });

    await purgeExpired(testDb.db, NOW);

    expect(
      await testDb.query<{ action: string; diff: unknown }>(
        "select action, diff from audit_logs",
      ),
    ).toEqual([
      {
        action: "retention.purged",
        diff: { purged: "messages=1 sessions=0 throttles=0 auditLogs=0" },
      },
    ]);
  });
});
