/**
 * Whether a state-changing request comes from this site's own pages. Next.js
 * already compares Origin and Host for server actions, but lets a request
 * without Origin through; the admin refuses it, and anything the browser
 * labels cross-site (Sec-Fetch-Site). Defense in depth on top of the
 * SameSite=Strict session cookie.
 */
export function isSameOriginRequest(headers: Headers): boolean {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin") {
    return false;
  }
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (origin === null || host === null || !URL.canParse(origin)) {
    return false;
  }
  return new URL(origin).host === host;
}
