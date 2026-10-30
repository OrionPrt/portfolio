// What a post's Markdown holds, read before it is drawn: its headings, for the
// table of contents, and how long it takes to read.

import GithubSlugger from "github-slugger";
import type { Heading, Root } from "mdast";
import { toString } from "mdast-util-to-string";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import { remarkCallouts } from "./markdown-directives";

/** Words a reader goes through in a minute, code included: a technical pace. */
const WORDS_PER_MINUTE = 200;

/** The heading levels the table of contents lists: `##` and `###`. */
const OUTLINE_DEPTHS: ReadonlySet<number> = new Set([2, 3]);

export interface OutlineHeading {
  /** 2 for `##`, 3 for `###`. */
  readonly depth: 2 | 3;
  readonly text: string;
  /** The heading's id on the page, prefix included. */
  readonly id: string;
}

export interface MarkdownOutline {
  readonly headings: readonly OutlineHeading[];
  readonly readingMinutes: number;
}

const parser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(remarkCallouts);

/** A heading's text as rehype-slug reads it: no image text, no raw HTML. */
function textOf(heading: Heading): string {
  return toString(heading, { includeImageAlt: false, includeHtml: false });
}

/**
 * The `##` and `###` headings, with the ids rehype-slug gives them on the page
 * (every heading counts toward a repeated id), and the reading time, a minute
 * at least.
 */
export function outlineOf(source: string, idPrefix: string): MarkdownOutline {
  const tree: Root = parser.runSync(parser.parse(source));
  const slugger = new GithubSlugger();
  const headings: OutlineHeading[] = [];
  visit(tree, "heading", (heading: Heading) => {
    const text = textOf(heading);
    const id = `${idPrefix}${slugger.slug(text)}`;
    if (OUTLINE_DEPTHS.has(heading.depth) && text.trim() !== "") {
      headings.push({ depth: heading.depth === 2 ? 2 : 3, text, id });
    }
  });
  const words = toString(tree, { includeHtml: false })
    .split(/\s+/)
    .filter((word) => word !== "").length;
  return {
    headings,
    readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
  };
}
