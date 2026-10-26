import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse, type ProxyConfig } from "next/server";

import {
  ADMIN_PATHS,
  isAdminPath,
  KNOWN_ADMIN_PATHS,
  PUBLIC_ADMIN_PATHS,
} from "@/features/auth/admin-paths";
import { SESSION_COOKIE } from "@/features/auth/vocabulary";
import { createPathGate } from "@/features/content/path-gate";
import { loadPublishedSlugs } from "@/features/content/published-slugs";
import { createSlugRegistry } from "@/features/content/slug-registry";
import { renderNotFoundPage } from "@/i18n/not-found-page";
import { routing } from "@/i18n/routing";
import {
  buildContentSecurityPolicy,
  createNonce,
  CSP_MODE,
  cspHeaderName,
} from "@/lib/csp";
import { isNonLocalized, isUnroutedPath } from "@/lib/non-localized-routes";

const CSP_HEADER_NAMES = [
  cspHeaderName("enforce"),
  cspHeaderName("report-only"),
];

/** Methods the site answers; anything else is refused before routing. */
const ALLOWED_METHODS: readonly string[] = ["GET", "HEAD", "POST"];

const handleI18nRouting = createMiddleware(routing);

// Published slugs are trusted for a minute; after a failed load, retried in ten seconds.
const pathGate = createPathGate(
  createSlugRegistry({
    load: loadPublishedSlugs,
    maxAgeMs: 60_000,
    retryAfterMs: 10_000,
  }),
);

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

/** The route Next.js will render: next-intl's rewrite target, else the path itself. */
function internalPathname(
  request: NextRequest,
  response: NextResponse,
): string {
  const rewrite = response.headers.get("x-middleware-rewrite");
  return rewrite === null
    ? request.nextUrl.pathname
    : new URL(rewrite).pathname;
}

/**
 * A real 404 for paths no page claims, or entries not published. Under Cache
 * Components a rendered route streams (status 200) before a page could call
 * notFound(), and a proxy rewrite cannot change that: the proxy answers itself,
 * with a static page (ADR-0003).
 */
function notFoundResponse(pathname: string): NextResponse {
  const [first] = pathname.split("/").filter(Boolean);
  const locale =
    routing.locales.find((candidate) => candidate === first) ??
    routing.defaultLocale;
  return new NextResponse(renderNotFoundPage(locale), {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // A slug published later must not stay cached as missing.
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * The admin: French only, outside the locale routing, and only its known
 * pages. Without a session cookie, only the login is reachable: an optimistic
 * check that spares a render. Pages and actions verify the session itself.
 */
function routeAdmin(
  request: NextRequest,
  forwardedHeaders: Headers,
): NextResponse {
  const { pathname } = request.nextUrl;
  if (!KNOWN_ADMIN_PATHS.has(pathname)) {
    return notFoundResponse(pathname);
  }
  if (
    !PUBLIC_ADMIN_PATHS.has(pathname) &&
    !request.cookies.has(SESSION_COOKIE)
  ) {
    const response = NextResponse.redirect(
      new URL(ADMIN_PATHS.login, request.url),
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  return NextResponse.next({ request: { headers: forwardedHeaders } });
}

async function routeRequest(
  request: NextRequest,
  forwardedHeaders: Headers,
  nonce: string,
): Promise<NextResponse> {
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
  if (isAdminPath(pathname)) {
    return routeAdmin(request, forwardedHeaders);
  }
  if (isNonLocalized(pathname)) {
    return isUnroutedPath(pathname)
      ? notFoundResponse(pathname)
      : NextResponse.next({ request: { headers: forwardedHeaders } });
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
  if (!reachesRenderer(response)) {
    return response;
  }
  // Fail closed: anything rendered must carry our nonce, or its scripts would go unsigned.
  if (response.headers.get("x-middleware-request-x-nonce") !== nonce) {
    return new NextResponse(null, { status: 500 });
  }
  const rendered = internalPathname(request, response);
  return (await pathGate.isKnown(rendered))
    ? response
    : notFoundResponse(rendered);
}

/**
 * Attaches a Content Security Policy with a fresh nonce to every response,
 * then lets next-intl resolve the locale (redirects, localized pathnames).
 * next-intl forwards the request headers it receives, so Next.js still reads
 * the nonce and signs its own scripts while rendering (ADR-0002).
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const nonce = createNonce();
  const headerName = cspHeaderName(CSP_MODE);
  const policy = buildContentSecurityPolicy({
    nonce,
    mode: CSP_MODE,
    isDev: process.env.NODE_ENV === "development",
  });

  const response = await routeRequest(
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
