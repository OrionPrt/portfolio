// Code highlighting for stored Markdown (ADR-0008): Shiki with its JavaScript
// regex engine (no WebAssembly), the grammars below only, two themes the page
// switches between with CSS. Built once per process, or per browser tab for
// the admin's preview.

import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

/**
 * The themes' names, as the highlighted code's CSS variables carry them. Every
 * token keeps 4.5:1 on the site's code background (#f4f4f5, #18181b): the
 * plain GitHub themes fall to 3.2 (orange) and 3.7 (comments).
 */
export const CODE_THEMES = {
  light: "github-light-high-contrast",
  dark: "github-dark-default",
} as const;

/**
 * The languages a code block may name (and their usual aliases, which the
 * grammars declare). Any other is shown as plain text. Loaded with the
 * highlighter, not with this module.
 */
const GRAMMARS = [
  () => import("shiki/langs/asm.mjs"),
  () => import("shiki/langs/c.mjs"),
  () => import("shiki/langs/cpp.mjs"),
  () => import("shiki/langs/diff.mjs"),
  () => import("shiki/langs/docker.mjs"),
  () => import("shiki/langs/haskell.mjs"),
  () => import("shiki/langs/html.mjs"),
  () => import("shiki/langs/http.mjs"),
  () => import("shiki/langs/javascript.mjs"),
  () => import("shiki/langs/json.mjs"),
  () => import("shiki/langs/php.mjs"),
  () => import("shiki/langs/powershell.mjs"),
  () => import("shiki/langs/python.mjs"),
  () => import("shiki/langs/rust.mjs"),
  () => import("shiki/langs/shellscript.mjs"),
  () => import("shiki/langs/sql.mjs"),
  () => import("shiki/langs/tsx.mjs"),
  () => import("shiki/langs/typescript.mjs"),
  () => import("shiki/langs/yaml.mjs"),
];

let loading: Promise<HighlighterCore> | undefined;

/**
 * Whether the text may hold a fenced code block: the only thing the
 * highlighter colours. A false "yes" (three backticks in a sentence) only
 * loads it for nothing.
 */
export function hasFencedCode(source: string): boolean {
  return source.includes("```") || source.includes("~~~");
}

/** The shared highlighter; a failed setup is tried again at the next call. */
export function loadHighlighter(): Promise<HighlighterCore> {
  loading ??= createHighlighterCore({
    themes: [
      () => import("shiki/themes/github-light-high-contrast.mjs"),
      () => import("shiki/themes/github-dark-default.mjs"),
    ],
    langs: GRAMMARS,
    // A grammar the engine cannot fully translate still highlights what it can.
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  }).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
