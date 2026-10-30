import { describe, expect, it } from "vitest";

import { hasFencedCode, loadHighlighter } from "./highlighter";

describe("hasFencedCode", () => {
  it.each([
    ["```sh\nls\n```", true],
    ["~~~\nplain\n~~~", true],
    ["- item\n\n  ```py\n  x\n  ```", true],
    ["Inline `code` only.", false],
    ["    an indented block", false],
  ])("tells whether %j may hold a fenced block", (source, expected) => {
    expect(hasFencedCode(source)).toBe(expected);
  });
});

describe("loadHighlighter", () => {
  it("knows the languages a write-up shows: web, diff and Dockerfile among them", async () => {
    const highlighter = await loadHighlighter();

    expect(highlighter.getLoadedLanguages()).toEqual(
      expect.arrayContaining(["php", "http", "html", "diff", "dockerfile"]),
    );
  }, 30_000);

  it("builds the highlighter once", async () => {
    expect(await loadHighlighter()).toBe(await loadHighlighter());
  }, 30_000);
});
