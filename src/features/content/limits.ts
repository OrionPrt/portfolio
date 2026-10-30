// Free of Zod: admin forms read these in the browser, where Zod must not go
// (it probes `new Function`, which the CSP reports).

/** The longest text each kind of content field takes. */
export const TEXT_LIMITS = {
  name: 120,
  title: 120,
  tagline: 200,
  summary: 800,
  seo: 160,
  markdown: 50_000,
  url: 2048,
  /** An image's alternative text: a sentence, not a caption. */
  alt: 200,
} as const;
