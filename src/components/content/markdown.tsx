import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { safeMarkdownUrl } from "@/features/content/safe-url";

type TopLevel = 2 | 3;

interface ChildrenProps {
  readonly children?: ReactNode;
}

const HEADING_TAGS = ["h2", "h3", "h4", "h5", "h6"] as const;

/** The tag for a Markdown heading, shifted under the page's own headings. */
function headingTag(topLevel: TopLevel, markdownLevel: number) {
  const level = Math.min(topLevel + Math.max(markdownLevel - 2, 0), 6);
  return HEADING_TAGS[level - 2] ?? "h6";
}

function headingFor(topLevel: TopLevel, markdownLevel: number) {
  const Tag = headingTag(topLevel, markdownLevel);
  return function Heading({ children }: ChildrenProps) {
    return <Tag>{children}</Tag>;
  };
}

function componentsFor(topLevel: TopLevel): Components {
  return {
    h1: headingFor(topLevel, 1),
    h2: headingFor(topLevel, 2),
    h3: headingFor(topLevel, 3),
    h4: headingFor(topLevel, 4),
    h5: headingFor(topLevel, 5),
    h6: headingFor(topLevel, 6),
    // Images arrive with media storage (P6), together with their CSP source:
    // until then the description stands in for the image.
    img: ({ alt }) =>
      alt === undefined || alt === "" ? null : <span>{alt}</span>,
    a: ({ href, children }) =>
      // safeMarkdownUrl empties an unsafe link: keep its text, drop the link.
      href === undefined || href === "" ? (
        <span>{children}</span>
      ) : (
        <a
          href={href}
          rel={href.startsWith("https:") ? "noopener noreferrer" : undefined}
        >
          {children}
        </a>
      ),
    // Wide code and tables scroll: keyboard users must reach them too.
    pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
    table: ({ children }) => <table tabIndex={0}>{children}</table>,
  };
}

const COMPONENTS: Readonly<Record<TopLevel, Components>> = {
  2: componentsFor(2),
  3: componentsFor(3),
};

interface MarkdownProps {
  readonly source: string;
  /** The level Markdown's top headings take: right under the enclosing heading. */
  readonly topLevel?: TopLevel;
}

/**
 * Renders stored Markdown (GFM) without raw HTML: tags in the source are
 * dropped, links only keep https, mailto and same-site URLs, and images show
 * their description.
 */
export function Markdown({ source, topLevel = 3 }: MarkdownProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={safeMarkdownUrl}
        components={COMPONENTS[topLevel]}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
