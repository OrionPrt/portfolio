import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { CSP_MODE, cspHeaderName } from "@/lib/csp";

import { proxy } from "./proxy";

// Simulates a next-intl code path that hands the request to Next.js without
// our forwarded headers (like its invalid-URI early return).
vi.mock("next-intl/middleware", async () => {
  const { NextResponse } = await import("next/server");
  return { default: () => () => NextResponse.next() };
});

describe("proxy — renderer post-condition", () => {
  it("refuses to render a request that lost the nonce on the way", () => {
    const response = proxy(new NextRequest("https://portfolio.test/fr"));

    expect(response.status).toBe(500);
    expect(response.headers.get(cspHeaderName(CSP_MODE))).not.toBeNull();
  });
});
