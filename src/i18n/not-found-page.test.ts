import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { renderNotFoundPage } from "./not-found-page";

const TOKENS = readFileSync(
  new URL("../styles/tokens.css", import.meta.url),
  "utf8",
);

/** The value of a custom property in the light (:root) or dark (.dark) block. */
function tokenValue(block: ":root" | ".dark", name: string): string {
  const body = TOKENS.split(block)[1]?.split("}")[0] ?? "";
  const declaration = body
    .split(/[{;]/)
    .find((part) => part.trim().startsWith(`--${name}:`));
  return declaration?.split(":")[1]?.trim() ?? "";
}

describe("renderNotFoundPage", () => {
  it("renders the French page, kept out of search engines", () => {
    const html = renderNotFoundPage("fr");

    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain("<title>Page introuvable · Orion</title>");
    expect(html).toContain("<h1>Page introuvable</h1>");
    expect(html).toContain(
      '<a class="home" href="/fr">Retour à l&#39;accueil</a>',
    );
  });

  it("renders the English page, with a link to the other language", () => {
    const html = renderNotFoundPage("en");

    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<h1>Page not found</h1>");
    expect(html).toContain('href="/en"');
    expect(html).toContain('<a href="/fr" hreflang="fr" lang="fr">');
  });

  it("ships no script, so nothing needs a CSP nonce", () => {
    expect(renderNotFoundPage("fr")).not.toMatch(/<script/i);
  });

  it.each([
    [":root", "ground"],
    [":root", "fg"],
    [":root", "fg-muted"],
    [":root", "accent"],
    [".dark", "ground"],
    [".dark", "fg"],
    [".dark", "fg-muted"],
    [".dark", "accent"],
  ] as const)("uses the %s %s colour of the design tokens", (block, name) => {
    const value = tokenValue(block, name);

    expect(value).toMatch(/^#/);
    expect(renderNotFoundPage("fr")).toContain(`--${name}:${value}`);
  });
});
