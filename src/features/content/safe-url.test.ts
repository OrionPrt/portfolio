import { describe, expect, it } from "vitest";

import { safeMarkdownUrl } from "./safe-url";

describe("safeMarkdownUrl", () => {
  it.each([
    "https://github.com/OrionPrt",
    "mailto:hello@example.com",
    "/fr/projets/portfolio",
    "#details",
  ])("keeps the safe link %j", (url) => {
    expect(safeMarkdownUrl(url)).toBe(url);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "http://example.com",
    "//evil.example",
    "/\\evil.example",
    "relative/path",
  ])("drops the link %j", (url) => {
    expect(safeMarkdownUrl(url)).toBe("");
  });
});
