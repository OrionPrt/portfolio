import { describe, expect, it } from "vitest";

import { clientIp } from "./client-ip";

describe("clientIp", () => {
  it.each([
    [{ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }, "203.0.113.7"],
    [{ "x-real-ip": "198.51.100.2" }, "198.51.100.2"],
    [{}, "unknown"],
    [{ "x-forwarded-for": "  " }, "unknown"],
    [{ "x-forwarded-for": "2001:db8::1" }, "2001:db8::1"],
    // Off Vercel the header is client-controlled: only an address is a key.
    [{ "x-forwarded-for": "a".repeat(64) }, "unknown"],
    [{ "x-real-ip": "not-an-ip" }, "unknown"],
  ])("reads %j as %s", (headers, ip) => {
    expect(clientIp(new Headers(headers))).toBe(ip);
  });
});
