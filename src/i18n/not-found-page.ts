import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

import { LOCALES, type Locale } from "./locales";

const MESSAGES = { fr, en } as const satisfies Record<Locale, unknown>;

const LANGUAGE_NAMES = {
  fr: fr.LocaleSwitcher.fr,
  en: en.LocaleSwitcher.en,
} as const satisfies Record<Locale, string>;

// The Graphite palette of src/styles/tokens.css (a test keeps them in sync).
// System fonts: this page loads nothing, not even the site's fonts.
const STYLE = `
:root{color-scheme:light dark;--ground:#fafafa;--fg:#09090b;--fg-muted:#52525b;--accent:#047857}
@media (prefers-color-scheme:dark){:root{--ground:#09090b;--fg:#fafafa;--fg-muted:#a1a1aa;--accent:#34d399}}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--ground);color:var(--fg);font-family:ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:36rem;padding:2rem 1rem;display:flex;flex-direction:column;align-items:flex-start;gap:1rem}
.label{margin:0;color:var(--accent);font-family:ui-monospace,monospace;font-size:.75rem}
h1{margin:0;font-size:2.25rem;font-weight:600;letter-spacing:-.025em}
p{margin:0;color:var(--fg-muted);line-height:1.6}
nav{display:flex;flex-wrap:wrap;align-items:center;gap:1rem}
a{color:var(--fg);text-underline-offset:4px}
a.home{display:inline-flex;height:2.5rem;align-items:center;padding:0 1rem;border:1px solid transparent;border-radius:8px;background:var(--fg);color:var(--ground);font-size:.875rem;font-weight:500;text-decoration:none}
a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
`;

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** One pass over the text: no replacement can be escaped twice. */
function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (character) => HTML_ENTITIES[character] ?? "",
  );
}

/**
 * The page the proxy answers with a real 404 status. Under Cache Components a
 * rendered route starts streaming (status 200) before notFound() can run, so
 * unknown paths never reach rendering (ADR-0003). Static on purpose: no script
 * to sign, no database, nothing taken from the request but the locale.
 */
export function renderNotFoundPage(locale: Locale): string {
  const t = MESSAGES[locale].NotFound;
  const other = LOCALES.find((candidate) => candidate !== locale) ?? locale;
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(t.title)} · Orion</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<p class="label"><span aria-hidden="true">// </span>404</p>
<h1>${escapeHtml(t.title)}</h1>
<p>${escapeHtml(t.description)}</p>
<nav>
<a class="home" href="/${locale}">${escapeHtml(t.home)}</a>
<a href="/${other}" hreflang="${other}" lang="${other}">${escapeHtml(LANGUAGE_NAMES[other])}</a>
</nav>
</main>
</body>
</html>
`;
}
