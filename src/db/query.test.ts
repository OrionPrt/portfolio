import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_OFFSET, MAX_PAGE_SIZE } from "./limits";
import { pickTranslation, runQuery, toPage } from "./query";

describe("toPage", () => {
  it("defaults to the first 20 rows", () => {
    expect(toPage()).toEqual({ limit: 20, offset: 0 });
  });

  it.each([
    [{ limit: 500 }, { limit: MAX_PAGE_SIZE, offset: 0 }],
    [{ limit: 0 }, { limit: 1, offset: 0 }],
    [
      { limit: -5, offset: -3 },
      { limit: 1, offset: 0 },
    ],
    [
      { limit: 7.9, offset: 2.5 },
      { limit: 7, offset: 2 },
    ],
    [
      { limit: Number.NaN, offset: Number.POSITIVE_INFINITY },
      { limit: 20, offset: 0 },
    ],
    [{ offset: 1e21 }, { limit: 20, offset: MAX_OFFSET }],
  ])("bounds %j to %j", (request, expected) => {
    expect(toPage(request)).toEqual(expected);
  });
});

describe("pickTranslation", () => {
  const fr = { locale: "fr" as const, title: "Bonjour" };
  const en = { locale: "en" as const, title: "Hello" };

  it("returns the requested locale", () => {
    expect(pickTranslation([fr, en], "en")).toEqual({
      value: en,
      isFallback: false,
    });
  });

  it("falls back to the default locale, flagged as such", () => {
    expect(pickTranslation([fr], "en")).toEqual({
      value: fr,
      isFallback: true,
    });
  });

  it("falls back to any locale when the default one is missing too", () => {
    expect(pickTranslation([en], "fr")).toEqual({
      value: en,
      isFallback: true,
    });
  });

  it("returns undefined when nothing is translated", () => {
    expect(pickTranslation([], "fr")).toBeUndefined();
  });
});

describe("runQuery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wraps a successful read", async () => {
    expect(await runQuery("test.read", () => Promise.resolve(42))).toEqual({
      ok: true,
      data: 42,
    });
  });

  it("turns a database failure into a logged DB_UNAVAILABLE error without leaking details", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await runQuery("projects.list_failed", () =>
      Promise.reject(new Error("password authentication failed for user app")),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "DB_UNAVAILABLE",
        message: "The database could not be reached.",
      },
    });
    expect(String(consoleError.mock.calls[0]?.[0])).toContain(
      "projects.list_failed",
    );
  });

  it("logs what failed, never the values, when they are personal data", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    // As Drizzle reports a failed insert: the values are in its message and
    // fields, and Postgres repeats the row in its detail.
    const cause = Object.assign(
      new Error('new row violates check constraint "contact_name_length"'),
      {
        code: "23514",
        constraint_name: "contact_name_length",
        detail: "Failing row contains (Ada Lovelace, secret body).",
      },
    );
    const failure = Object.assign(
      new Error("Failed query: insert … params: Ada Lovelace,secret body", {
        cause,
      }),
      { query: "insert …", params: ["Ada Lovelace", "secret body"] },
    );

    const result = await runQuery(
      "contact.create_failed",
      () => Promise.reject(failure),
      { hasPersonalData: true },
    );

    expect(result.ok).toBe(false);
    const logged = consoleError.mock.calls.flat().map(String).join("\n");
    expect(logged).toContain("contact.create_failed");
    expect(logged).toContain("23514");
    expect(logged).toContain("contact_name_length");
    expect(logged).not.toContain("Ada Lovelace");
    expect(logged).not.toContain("secret body");
  });
});
