import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { contrastRatio } from "../../test/contrast";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

// WCAG 2.2 AA: 4.5:1 for text, 3:1 for focus indicators and other UI parts.
const TEXT_MINIMUM = 4.5;
const UI_MINIMUM = 3;

const TEXT_PAIRS = [
  ["fg", "ground"],
  ["fg", "surface"],
  ["fg", "surface-muted"],
  ["fg-muted", "ground"],
  ["fg-muted", "surface"],
  ["fg-muted", "surface-muted"],
  ["accent", "ground"],
  ["accent", "surface"],
  ["accent", "surface-muted"],
  ["danger", "ground"],
  ["danger", "surface"],
  ["warning", "surface"],
] as const;

const UI_PAIRS = [
  ["focus", "ground"],
  ["focus", "surface"],
  ["control-border", "ground"],
  ["control-border", "surface"],
  ["danger", "surface"],
  ["warning", "surface"],
  ["accent", "surface"],
] as const;

function tokensOf(selector: RegExp): ReadonlyMap<string, string> {
  const block = selector.exec(css)?.[1];
  if (block === undefined) {
    throw new Error(`No ${selector.source} block in tokens.css`);
  }
  const declarations = [...block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)];
  return new Map(
    declarations.map(([, name = "", value = ""]) => [name, value.trim()]),
  );
}

const themes = {
  light: tokensOf(/:root\s*\{([^}]*)\}/),
  dark: tokensOf(/\.dark\s*\{([^}]*)\}/),
} as const;

function colour(theme: ReadonlyMap<string, string>, name: string): string {
  const value = theme.get(name);
  if (value === undefined) {
    throw new Error(`Missing token --${name}`);
  }
  return value;
}

describe.each(Object.entries(themes))("%s theme", (_name, theme) => {
  it.each(TEXT_PAIRS)(
    "keeps --%s readable on --%s (WCAG AA)",
    (foreground, background) => {
      const ratio = contrastRatio(
        colour(theme, foreground),
        colour(theme, background),
      );

      expect(ratio).toBeGreaterThanOrEqual(TEXT_MINIMUM);
    },
  );

  it.each(UI_PAIRS)("keeps --%s visible on --%s", (foreground, background) => {
    const ratio = contrastRatio(
      colour(theme, foreground),
      colour(theme, background),
    );

    expect(ratio).toBeGreaterThanOrEqual(UI_MINIMUM);
  });
});

describe("tokens.css", () => {
  it("defines the same tokens in both themes", () => {
    expect([...themes.dark.keys()].sort()).toEqual(
      [...themes.light.keys()].sort(),
    );
  });
});
