import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import type { HighlighterCore } from "shiki/core";

import { loadHighlighter } from "@/features/content/highlighter";
import { outlineOf } from "@/features/content/markdown-outline";

import { Markdown } from "./markdown";

const ENGLISH = { note: "Note", warning: "Warning", details: "Details" };

let highlighter: HighlighterCore;

beforeAll(async () => {
  highlighter = await loadHighlighter();
}, 30_000);

describe("Markdown directives", () => {
  it("sets a note or a warning apart, titled by its kind unless its author titled it", () => {
    render(
      <Markdown
        source={
          ":::note\nRead this.\n:::\n\n:::warning[Mind the gap]\nCareful.\n:::"
        }
        labels={ENGLISH}
      />,
    );
    const [note = document.body, warning = document.body] =
      screen.getAllByRole("note");

    expect(within(note).getByText("Note")).toHaveClass("callout-title");
    expect(within(note).getByText("Read this.")).toBeVisible();
    expect(note).toHaveAttribute("data-callout", "note");
    expect(within(warning).getByText("Mind the gap")).toHaveClass(
      "callout-title",
    );
    expect(within(warning).queryByText("Warning")).toBeNull();
  });

  it("folds :::details behind its label, or the page's word", () => {
    const { container } = render(
      <Markdown
        source={":::details[Spoiler]\nThe flag.\n:::\n\n:::details\nMore.\n:::"}
        labels={ENGLISH}
      />,
    );
    const summaries = [...container.querySelectorAll("details > summary")];

    expect(summaries.map((summary) => summary.textContent)).toEqual([
      "Spoiler",
      "Details",
    ]);
  });

  it("keeps no attribute an author gives a directive", () => {
    const { container } = render(
      <Markdown
        source={
          ':::note{.evil #trap style="color:red" onclick="alert(1)"}\nHi\n:::'
        }
      />,
    );
    const note = screen.getByRole("note");

    expect(note.className).toBe("callout");
    expect(note).not.toHaveAttribute("style");
    expect(note).not.toHaveAttribute("id");
    expect(container.innerHTML).not.toMatch(/onclick|evil|trap/);
  });

  it("restores a directive written inside another one's label", () => {
    const { container } = render(<Markdown source={"See :a[:b[c]] here."} />);

    expect(container).toHaveTextContent("See :a[:b[c]] here.");
    expect(container.querySelector("p div")).toBeNull();
  });

  it("reads any other directive as the text it was written as", () => {
    const { container } = render(
      <Markdown source={"Raison:valeur et ::leaf\n\n:::unknown\nKept.\n:::"} />,
    );

    expect(container).toHaveTextContent("Raison:valeur et ::leaf");
    expect(container).toHaveTextContent("Kept.");
    expect(screen.queryByRole("note")).toBeNull();
  });
});

describe("Markdown anchors and outline", () => {
  const SOURCE = "## Recon\n\n### Ports\n\n## Recon\n\nText";

  it("gives headings prefixed ids, the ones the table of contents links to", () => {
    const { container } = render(
      <Markdown source={SOURCE} headingIdPrefix="fr-" />,
    );
    const ids = [...container.querySelectorAll("h3, h4")].map(
      (heading) => heading.id,
    );

    expect(ids).toEqual(["fr-recon", "fr-ports", "fr-recon-1"]);
    expect(
      outlineOf(SOURCE, "fr-").headings.map((heading) => heading.id),
    ).toEqual(ids);
  });

  it("gives no ids unless asked", () => {
    const { container } = render(<Markdown source={SOURCE} />);

    expect(container.querySelector("[id]")).toBeNull();
  });
});

describe("Markdown code", () => {
  it("colours a known language with both themes' variables", () => {
    const { container } = render(
      <Markdown
        source={"```c\nint main(void) { return 0; }\n```"}
        highlighter={highlighter}
      />,
    );
    const pre = container.querySelector("pre");
    const token = pre?.querySelector("span[style]");

    expect(pre?.className).toContain("shiki");
    expect(pre).toHaveAttribute("tabindex", "0");
    expect(token?.getAttribute("style")).toMatch(
      /--shiki-light:.*--shiki-dark:/,
    );
  });

  it("shows an unknown language, or none, as plain text", () => {
    const { container } = render(
      <Markdown
        source={
          "```brainfuck\n+[-->-[>>+>-----<<]<--<---]\n```\n\n```\nplain\n```"
        }
        highlighter={highlighter}
      />,
    );

    expect(container.querySelectorAll("pre")).toHaveLength(2);
    expect(container).toHaveTextContent("+[-->-[>>+>-----<<]<--<---]");
  });
});

describe("Markdown against injection", () => {
  // From OWASP's XSS filter evasion cheat sheet, as Markdown can carry them.
  const CORPUS = [
    "<script>alert(1)</script>",
    '<img src=x onerror="alert(1)">',
    '<a href="javascript:alert(1)">x</a>',
    "[click](javascript:alert(1))",
    "[click](JaVaScRiPt:alert(1))",
    "[click](&#106;avascript:alert(1))",
    "[click](  javascript:alert(1))",
    "[click](<java\tscript:alert(1)>)",
    "[ref][evil]\n\n[evil]: javascript:alert(1)",
    "[click](vbscript:msgbox(1))",
    "[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)",
    "<javascript:alert(1)>",
    "![x](javascript:alert(1))",
    "![outside](https://evil.example/pixel.png)",
    '![x](media:x "onerror=alert(1)")',
    '<svg onload="alert(1)">',
    '<iframe src="https://evil.example">',
    '<form action="javascript:alert(1)"><button formaction="javascript:alert(1)">x</button></form>',
    '```" onmouseover="alert(1)\ncode\n```',
    ':::note{onclick="alert(1)" #main-fr .x style="color:red"}\nx\n:::',
    ":a[:b{onclick=alert(1)}[c]]",
    "## <img src=x onerror=alert(1)> Title {#main-fr}",
    '[x](https://example.com "title" onclick=alert(1))',
    "Footnote[^1]\n\n[^1]: <script>alert(1)</script>",
  ].join("\n\n");

  /** Every attribute the renderer may write, and nothing else. */
  const ALLOWED = new Set([
    "href",
    "rel",
    "class",
    "style",
    "id",
    "tabindex",
    "role",
    "data-callout",
    "data-callout-title",
    "aria-describedby",
    "aria-label",
    "data-footnote-ref",
    "data-footnote-backref",
    "data-footnotes",
  ]);

  it("neutralizes the corpus: no script, no handler, no unsafe link, no outside image", () => {
    const { container } = render(
      <Markdown
        source={CORPUS}
        highlighter={highlighter}
        headingIdPrefix="post-x-fr-h-"
      />,
    );
    const elements = [...container.querySelectorAll("*")];

    expect(
      container.querySelector("script, iframe, svg, object, embed, form, img"),
    ).toBeNull();
    for (const element of elements) {
      for (const attribute of element.getAttributeNames()) {
        expect(ALLOWED, `${element.tagName} ${attribute}`).toContain(attribute);
      }
      const href = element.getAttribute("href") ?? "";
      expect(href).not.toMatch(/^\s*(javascript|vbscript|data):/i);
      const style = element.getAttribute("style");
      if (style !== null) {
        // Shiki's colour variables only, as the DOM writes them back.
        expect(style).toMatch(/^(\s*--shiki-[a-z-]+:\s*#[0-9a-fA-F]{3,8};?)+$/);
      }
    }
    expect(container.querySelector("#main-fr")).toBeNull();
  });
});
