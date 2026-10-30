import { describe, expect, it } from "vitest";

import { outlineOf } from "./markdown-outline";

describe("outlineOf", () => {
  it("lists the ## and ### headings, with the ids the page gives them", () => {
    const outline = outlineOf(
      "# Title\n\n## Recon `nmap`\n\n#### Deep\n\n### Ports\n\n## Recon `nmap`",
      "en-",
    );

    expect(outline.headings).toEqual([
      { depth: 2, text: "Recon nmap", id: "en-recon-nmap" },
      { depth: 3, text: "Ports", id: "en-ports" },
      { depth: 2, text: "Recon nmap", id: "en-recon-nmap-1" },
    ]);
  });

  it("names a heading without its image's text, as the page does", () => {
    expect(
      outlineOf("## Diagram ![a scheme](media:x)", "").headings[0]?.id,
    ).toBe("diagram-");
  });

  it("counts a minute at least, then one per 200 words, code included", () => {
    expect(outlineOf("A few words.", "").readingMinutes).toBe(1);
    const words = Array.from({ length: 600 }, () => "word").join(" ");
    expect(
      outlineOf(`${words}\n\n\`\`\`c\n${words}\n\`\`\``, "").readingMinutes,
    ).toBe(6);
  });
});
