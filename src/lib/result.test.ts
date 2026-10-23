import { describe, expect, it, vi } from "vitest";

import { err, map, ok } from "./result";

describe("result", () => {
  it("wraps a success value", () => {
    expect(ok(42)).toEqual({ ok: true, data: 42 });
  });

  it("wraps an application error", () => {
    const error = { code: "NOT_FOUND", message: "Project not found" };

    expect(err(error)).toEqual({ ok: false, error });
  });

  it("transforms the data of a success", () => {
    const result = map(ok(2), (value) => value * 10);

    expect(result).toEqual({ ok: true, data: 20 });
  });

  it("propagates an error without calling the transform", () => {
    const failure = err({
      code: "DB_UNAVAILABLE",
      message: "Database unavailable",
    });
    const transform = vi.fn((value: number) => value * 10);

    const result = map(failure, transform);

    expect(result).toBe(failure);
    expect(transform).not.toHaveBeenCalled();
  });
});
