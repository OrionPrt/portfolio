interface HttpHeader {
  readonly key: string;
  readonly value: string;
}

/**
 * Static headers applied to every response by next.config.ts.
 * The Content Security Policy needs a per-request nonce, so it lives in src/proxy.ts.
 */
export const SECURITY_HEADERS: readonly HttpHeader[] = [
  // Two years, preload-eligible. Submit to hstspreload.org only once the final domain is live (P12).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Legacy counterpart of the CSP `frame-ancestors 'none'` directive.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), browsing-topics=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // same-origin rather than same-site: a compromised sibling subdomain cannot embed our resources.
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];
