import { describe, expect, it } from "vitest";

import { utcDate } from "./dates";

describe("utcDate", () => {
  it("reads a stored ISO date as midnight UTC, whatever the server's zone", () => {
    expect(utcDate("2024-03-01").toISOString()).toBe(
      "2024-03-01T00:00:00.000Z",
    );
  });
});
