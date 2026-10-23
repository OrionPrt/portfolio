import { NextResponse, type NextRequest, type ProxyConfig } from "next/server";

import {
  buildContentSecurityPolicy,
  createNonce,
  CSP_MODE,
  cspHeaderName,
} from "@/lib/csp";

const CSP_HEADER_NAMES = [
  cspHeaderName("enforce"),
  cspHeaderName("report-only"),
];

/**
 * Attaches a Content Security Policy with a fresh nonce to every response.
 * The policy is also set on the forwarded request: Next.js reads the nonce
 * from it and signs its own scripts while rendering (ADR-0002).
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = createNonce();
  const headerName = cspHeaderName(CSP_MODE);
  const policy = buildContentSecurityPolicy({
    nonce,
    mode: CSP_MODE,
    isDev: process.env.NODE_ENV === "development",
  });

  const requestHeaders = new Headers(request.headers);
  // Next.js would read a client-supplied policy header instead of ours and leave scripts unsigned.
  for (const name of CSP_HEADER_NAMES) {
    requestHeaders.delete(name);
  }
  requestHeaders.set(headerName, policy);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(headerName, policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Fail closed: everything is covered except build assets and a short list of exact
      // static files. An extension never exempts a path, since `/page.svg` can be a page.
      source:
        "/((?!_next/static/|_next/image|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$).*)",
      // In-app router prefetches return flight data, not HTML. Browser document prefetches
      // (`Purpose: prefetch`) are HTML that may be reused for a navigation: they stay covered.
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
} satisfies ProxyConfig;
