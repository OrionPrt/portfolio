import { describe, expect, it } from "vitest";

import {
  describeUserAgent,
  formatMonthYear,
  formatParisDateTime,
} from "./format";

describe("describeUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0",
      "Firefox · Linux",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      "Edge · Windows",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      "Chrome · macOS",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
      "Safari · iOS",
    ],
    [
      "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
      "Chrome · Android",
    ],
    ["curl/8.5.0", undefined],
    [null, undefined],
  ])("reads %j as %j", (userAgent, description) => {
    expect(describeUserAgent(userAgent)).toBe(description);
  });
});

describe("formatParisDateTime", () => {
  it("writes the date and time in Paris", () => {
    expect(formatParisDateTime(new Date("2026-10-25T12:00:00Z"))).toBe(
      "25 oct. 2026, 13:00",
    );
  });
});

describe("formatMonthYear", () => {
  it("names a stored day's month, never the day before", () => {
    expect(formatMonthYear("2024-01-01")).toBe("janvier 2024");
    expect(formatMonthYear("2024-12-31")).toBe("décembre 2024");
  });
});
