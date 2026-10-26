import { describe, expect, it } from "vitest";

import { rowsOf } from "./rows";

describe("rowsOf", () => {
  it("reads the rows of every driver's raw result", () => {
    // postgres.js: the result is the array; Neon and PGlite: `.rows`.
    expect(rowsOf([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(rowsOf({ rows: [{ id: 2 }], rowCount: 1 })).toEqual([{ id: 2 }]);
  });

  it("refuses a shape it does not know, rather than guess", () => {
    expect(() => rowsOf({ count: 1 })).toThrow("Unexpected query result");
    expect(() => rowsOf(null)).toThrow("Unexpected query result");
  });
});
