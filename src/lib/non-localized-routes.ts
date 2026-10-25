/** Paths outside the [locale] tree: they get the CSP, but no locale redirect. */
export const NON_LOCALIZED_PREFIXES: readonly string[] = [
  "/api/",
  "/_vercel/",
  "/.well-known/",
  "/assets/",
];

// Under these prefixes only the listed paths exist (a test checks the list
// against src/app/api): anything else gets the proxy's 404 page, since the
// default one of Next.js ships scripts without a nonce.
const ROUTED_PREFIXES: readonly string[] = ["/api/", "/.well-known/"];

export const ROUTED_PATHS: ReadonlySet<string> = new Set(["/api/csp-report"]);

export function isNonLocalized(pathname: string): boolean {
  return NON_LOCALIZED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** A path under a routed prefix that no route handler serves. */
export function isUnroutedPath(pathname: string): boolean {
  return (
    ROUTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    !ROUTED_PATHS.has(pathname)
  );
}
