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
});
