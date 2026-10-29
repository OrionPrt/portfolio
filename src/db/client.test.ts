import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import { ok } from "@/lib/result";

// A fresh module per test: the client memoizes its connection.
async function loadClient() {
  vi.resetModules();
  return import("./client");
}

describe("withDatabase", () => {
  let consoleError: MockInstance;

  beforeEach(() => {
    consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.doUnmock("@neondatabase/serverless");
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("fails as DB_UNAVAILABLE, and logs why, when DATABASE_URL is unset", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { withDatabase } = await loadClient();
    const read = vi.fn();

    const result = await withDatabase(read);

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "DB_UNAVAILABLE" }) as unknown,
    });
    expect(read).not.toHaveBeenCalled();
    expect(String(consoleError.mock.calls[0]?.[0])).toContain(
      "db.not_configured",
    );
  });

  it("fails as DB_UNAVAILABLE, and logs it, when the driver cannot be set up", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://app:secret@db.example.com/app");
    vi.doMock("@neondatabase/serverless", () => ({
      neon: () => {
        throw new Error("invalid connection string");
      },
      neonConfig: {},
    }));
    const { withDatabase } = await loadClient();
    const read = vi.fn();

    const result = await withDatabase(read);

    expect(result.ok).toBe(false);
    expect(read).not.toHaveBeenCalled();
    expect(String(consoleError.mock.calls[0]?.[0])).toContain(
      "db.connect_failed",
    );
  });

  it("speaks plain Postgres to a local database, without the Neon driver", async () => {
    // postgres.js connects lazily: no socket opens in this test.
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://postgres@localhost:5432/portfolio",
    );
    vi.doMock("@neondatabase/serverless", () => ({
      neon: () => {
        throw new Error("The Neon driver must not serve a local database.");
      },
      neonConfig: {},
    }));
    const { withDatabase } = await loadClient();

    const result = await withDatabase((db) => Promise.resolve(ok(db)));

    expect(result.ok && result.data).toBeDefined();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("refuses a local database on Vercel, where it can only be a mistake", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://postgres@localhost:5432/portfolio",
    );
    vi.stubEnv("VERCEL_ENV", "production");
    const { withDatabase } = await loadClient();
    const read = vi.fn();

    const result = await withDatabase(read);

    expect(result.ok).toBe(false);
    expect(read).not.toHaveBeenCalled();
    expect(String(consoleError.mock.calls[0]?.[0])).toContain(
      "db.connect_failed",
    );
  });

  it("hands the same database to every read once configured", async () => {
    // neon() connects lazily: no request leaves the test.
    vi.stubEnv("DATABASE_URL", "postgresql://app:secret@db.example.com/app");
    const { withDatabase } = await loadClient();
    const seen: unknown[] = [];

    const first = await withDatabase((db) => {
      seen.push(db);
      return Promise.resolve(ok("first"));
    });
    await withDatabase((db) => {
      seen.push(db);
      return Promise.resolve(ok("second"));
    });

    expect(first).toEqual({ ok: true, data: "first" });
    expect(seen[0]).toBeDefined();
    expect(seen[1]).toBe(seen[0]);
  });

  it.each([
    ["the owner's", "postgresql://neondb_owner:secret@db.example.com/app", 1],
    [
      "the site's role's",
      "postgresql://portfolio_app:secret@db.example.com/app",
      0,
    ],
  ])(
    "on Vercel, warns when the site connects with %s string",
    async (_case, url, warnings) => {
      vi.stubEnv("DATABASE_URL", url);
      vi.stubEnv("VERCEL_ENV", "preview");
      const sink = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      const { withDatabase } = await loadClient();

      await withDatabase(() => Promise.resolve(ok("read")));

      const warned = sink.mock.calls.filter((call) =>
        String(call[0]).includes("db.not_app_role"),
      );
      expect(warned).toHaveLength(warnings);
      expect(String(warned[0]?.[0] ?? "")).not.toContain("secret");
    },
  );
});
