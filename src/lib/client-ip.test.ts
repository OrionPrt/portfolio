import { describe, expect, it } from "vitest";

import { clientIp, senderNetwork } from "./client-ip";

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
  ])("reads %j as %s on Vercel", (headers, ip) => {
    expect(clientIp(new Headers(headers), true)).toBe(ip);
  });

  it("trusts no forwarding header off Vercel, where clients can write them", () => {
    expect(
      clientIp(new Headers({ "x-forwarded-for": "203.0.113.7" }), false),
    ).toBe("unknown");
  });
});

describe("senderNetwork", () => {
  it.each([
    ["203.0.113.7", "203.0.113.7"],
    // An IPv4 client reached over IPv6 is still that IPv4 address.
    ["::ffff:203.0.113.7", "203.0.113.7"],
    // One subscriber usually holds a whole /64: it counts as one sender.
    ["2001:db8:1:2:3:4:5:6", "2001:db8:1:2::/64"],
    ["2001:db8::1", "2001:db8:0:0::/64"],
    ["2001:DB8:0001:0002::abcd", "2001:db8:1:2::/64"],
    ["64:ff9b::192.0.2.1", "64:ff9b:0:0::/64"],
    ["fe80::1%eth0", "fe80:0:0:0::/64"],
    ["unknown", "unknown"],
  ])("counts %s as %s", (ip, network) => {
    expect(senderNetwork(ip)).toBe(network);
  });
});
