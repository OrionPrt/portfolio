const SAFE_SCHEMES = ["https:", "mailto:"] as const;

/**
 * The links and images Markdown may render: https, mailto, and paths or
 * fragments of this site. Anything else (javascript:, data:, http:,
 * protocol-relative //host) becomes an empty URL, which renders inert.
 */
export function safeMarkdownUrl(url: string): string {
  // A same-site path: one leading slash, not followed by another or a backslash.
  if (/^\/(?![/\\])/.test(url) || url.startsWith("#")) {
    return url;
  }
  if (!URL.canParse(url)) {
    return "";
  }
  const { protocol } = new URL(url);
  return SAFE_SCHEMES.some((scheme) => scheme === protocol) &&
    url.toLowerCase().startsWith(protocol)
    ? url
    : "";
}
