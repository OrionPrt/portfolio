import { describe, expect, it } from "vitest";

import { siteToday, utcDate } from "./dates";

describe("utcDate", () => {
  it("reads a stored ISO date as midnight UTC, whatever the server's zone", () => {
    expect(utcDate("2024-03-01").toISOString()).toBe(
      "2024-03-01T00:00:00.000Z",
    );
  });
});

describe("siteToday", () => {
  it("dates by Paris: an evening in UTC can be tomorrow there", () => {
    expect(siteToday(new Date("2026-10-30T12:00:00Z"))).toBe("2026-10-30");
    expect(siteToday(new Date("2026-10-30T23:30:00Z"))).toBe("2026-10-31");
  });
});
