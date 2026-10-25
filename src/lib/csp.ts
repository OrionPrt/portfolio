export type CspMode = "report-only" | "enforce";

/** Enforced since the end of P3, before the first user-input form ships (ADR-0002). */
export const CSP_MODE: CspMode = "enforce";

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/** Where browsers send violation reports (src/app/api/csp-report/route.ts). */
export const CSP_REPORT_PATH = "/api/csp-report";

/** The Reporting-Endpoints group name the `report-to` directive refers to. */
export const CSP_REPORT_GROUP = "csp-endpoint";

interface CspOptions {
  readonly nonce: string;
  readonly mode: CspMode;
  readonly isDev: boolean;
}

const NONCE_BYTES = 16;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/** 128 bits from the platform CSPRNG, base64-encoded as Next.js expects. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  return btoa(String.fromCharCode(...bytes));
}

export function cspHeaderName(mode: CspMode): string {
  return mode === "enforce"
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";
}

export function buildContentSecurityPolicy({
  nonce,
  mode,
  isDev,
}: CspOptions): string {
  // The nonce is interpolated into a header: anything but base64 could inject directives.
  if (!BASE64_PATTERN.test(nonce)) {
    throw new Error("Invalid CSP nonce: expected a base64 string");
  }

  const directives: readonly (readonly string[])[] = [
    ["default-src", "'self'"],
    // 'strict-dynamic' lets nonce-signed scripts load their own chunks; React needs eval in dev only.
    [
      "script-src",
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // Style attributes (React `style`, animations) cannot carry a nonce: see ADR-0002.
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "data:", "blob:"],
    ["font-src", "'self'"],
    ["connect-src", "'self'"],
    // Cloudflare Turnstile renders its challenge in an iframe (contact form).
    // Its loader needs no host here: our signed code inserts it ('strict-dynamic').
    ["frame-src", TURNSTILE_ORIGIN],
    ["object-src", "'none'"],
    ["base-uri", "'none'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
    // Ignored (with a console warning) in report-only mode, and breaks plain-http localhost.
    ...(mode === "enforce" && !isDev ? [["upgrade-insecure-requests"]] : []),
    // report-to (Reporting API) where supported; report-uri for the others (Firefox).
    ["report-to", CSP_REPORT_GROUP],
    ["report-uri", CSP_REPORT_PATH],
  ];

  return directives.map((sources) => sources.join(" ")).join("; ");
}
