import { serializeJsonLd } from "@/features/seo/json-ld";

interface JsonLdProps {
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * Structured data for search engines. A data block, never executed, so it
 * needs no CSP nonce; serializeJsonLd escapes "<", so stored text cannot close
 * the element.
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // Safe: the only input is JSON from serializeJsonLd, escaped for <script>.
      // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
