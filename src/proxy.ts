import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse, type ProxyConfig } from "next/server";

import { routing } from "@/i18n/routing";
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

/** Methods the site answers; anything else is refused before routing. */
const ALLOWED_METHODS: readonly string[] = ["GET", "HEAD", "POST"];

/** Paths outside the [locale] tree: they get the CSP, but no locale redirect. */
const NON_LOCALIZED_PREFIXES: readonly string[] = [
  "/api/",
  "/_vercel/",
  "/.well-known/",
  "/assets/",
];

const handleI18nRouting = createMiddleware(routing);

/** Request headers for the renderer: our policy and nonce, never a client-supplied policy. */
function withPolicy(
  headers: Headers,
  headerName: string,
  policy: string,
  nonce: string,
): Headers {
  const forwarded = new Headers(headers);
  // Next.js would read a client-supplied policy header instead of ours and leave scripts unsigned.
  for (const name of CSP_HEADER_NAMES) {
    forwarded.delete(name);
  }
  forwarded.set(headerName, policy);
  forwarded.set("x-nonce", nonce);
  return forwarded;
}

function isDecodable(pathname: string): boolean {
  try {
    decodeURI(pathname);
    return true;
  } catch {
    return false;
  }
}

/** True when Next.js goes on to render the request, rather than redirecting it. */
function reachesRenderer(response: NextResponse): boolean {
  return (
    response.headers.has("x-middleware-next") ||
    response.headers.has("x-middleware-rewrite")
  );
}

function routeRequest(
  request: NextRequest,
  forwardedHeaders: Headers,
  nonce: string,
): NextResponse {
  if (!ALLOWED_METHODS.includes(request.method)) {
    return new NextResponse(null, {
      status: 405,
      headers: { Allow: ALLOWED_METHODS.join(", ") },
    });
  }
  const { pathname } = request.nextUrl;
  // next-intl hands undecodable paths to Next.js without our headers: refuse them first.
  if (!isDecodable(pathname)) {
    return new NextResponse(null, { status: 400 });
  }
  if (NON_LOCALIZED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next({ request: { headers: forwardedHeaders } });
  }

  const response = handleI18nRouting(
    new NextRequest(request.url, {
      method: request.method,
      headers: forwardedHeaders,
    }),
  );
  if (response.headers.has("location")) {
    // The target depends on Accept-Language and the locale cookie.
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vary", "Accept-Language, Cookie");
  }
  // Fail closed: anything rendered must carry our nonce, or its scripts would go unsigned.
  if (
    reachesRenderer(response) &&
    response.headers.get("x-middleware-request-x-nonce") !== nonce
  ) {
    return new NextResponse(null, { status: 500 });
  }
  return response;
}

/**
 * Attaches a Content Security Policy with a fresh nonce to every response,
 * then lets next-intl resolve the locale (redirects, localized pathnames).
 * next-intl forwards the request headers it receives, so Next.js still reads
 * the nonce and signs its own scripts while rendering (ADR-0002).
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = createNonce();
  const headerName = cspHeaderName(CSP_MODE);
  const policy = buildContentSecurityPolicy({
    nonce,
    mode: CSP_MODE,
    isDev: process.env.NODE_ENV === "development",
  });

  const response = routeRequest(
    request,
    withPolicy(request.headers, headerName, policy, nonce),
    nonce,
  );
  response.headers.set(headerName, policy);
  return response;
}

export const config = {
  // Fail closed: everything is covered except build assets and a short list of exact
  // static files. An extension never exempts a path, since `/page.svg` can be a page.
  // Prefetches are covered too: next-intl must rewrite their localized pathnames, or a
  // prefetched `/fr/projets/x` would resolve to the catch-all 404 and be reused on click.
  matcher: [
    "/((?!_next/static/|_next/image|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$).*)",
  ],
} satisfies ProxyConfig;
