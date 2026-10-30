import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import type { CSSProperties, ReactNode } from "react";
import ReactMarkdown, {
  type Components,
  type ExtraProps,
} from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import type { HighlighterCore } from "shiki/core";
import type { Pluggable, PluggableList } from "unified";

import { MediaImage } from "@/components/ui/media-image";
import { CODE_THEMES } from "@/features/content/highlighter";
import {
  CALLOUT_KINDS,
  remarkCallouts,
  type CalloutKind,
} from "@/features/content/markdown-directives";
import { safeMarkdownUrl } from "@/features/content/safe-url";
import { mediaIdOf } from "@/features/media/references";
import type { MediaById, MediaView } from "@/features/media/types";

/** A node of the rendered tree, as react-markdown hands it to a component. */
type Element = NonNullable<ExtraProps["node"]>;

type MarkdownImages = MediaById;

/** The text column's width, at most: what the browser picks a size for. */
const TEXT_SIZES = "(min-width: 768px) 720px, 100vw";

type TopLevel = 2 | 3;

interface ChildrenProps {
  readonly children?: ReactNode;
}

interface HeadingProps extends ChildrenProps {
  /** rehype-slug's, when the page asks for anchors. */
  readonly id?: string;
  /** GFM's footnotes label their section with a heading only screen readers see. */
  readonly className?: string;
}

/** What a callout says when its Markdown gives it no title: the page's language. */
export type CalloutLabels = Readonly<Record<CalloutKind, string>>;

/** The words a caller gives no others for: the site's default language. */
const FRENCH_LABELS: CalloutLabels = {
  note: "Note",
  warning: "Attention",
  details: "Détails",
};

const HEADING_TAGS = ["h2", "h3", "h4", "h5", "h6"] as const;

/** The tag for a Markdown heading, shifted under the page's own headings. */
function headingTag(topLevel: TopLevel, markdownLevel: number) {
  const level = Math.min(topLevel + Math.max(markdownLevel - 2, 0), 6);
  return HEADING_TAGS[level - 2] ?? "h6";
}

function headingFor(topLevel: TopLevel, markdownLevel: number) {
  const Tag = headingTag(topLevel, markdownLevel);
  return function Heading({ id, className, children }: HeadingProps) {
    return (
      <Tag id={id} className={className === "sr-only" ? className : undefined}>
        {children}
      </Tag>
    );
  };
}

interface MarkdownImageProps {
  readonly src: unknown;
  readonly alt: unknown;
  readonly images: MarkdownImages;
}

/** The library's image a src names, if the page has it. */
function imageOf(src: unknown, images: MarkdownImages): MediaView | undefined {
  const id = typeof src === "string" ? mediaIdOf(src) : undefined;
  return id === undefined ? undefined : images[id];
}

/** The Markdown's own text, else the library's: an image is never left unnamed. */
function altOf(alt: unknown, image: MediaView): string {
  return typeof alt === "string" && alt.trim() !== "" ? alt : image.alt;
}

/** An image within a sentence: the image itself, or its description. */
function InlineImage({ src, alt, images }: MarkdownImageProps) {
  const image = imageOf(src, images);
  if (image === undefined) {
    return typeof alt === "string" && alt.trim() !== "" ? (
      <span>{alt}</span>
    ) : null;
  }
  return (
    <MediaImage
      image={image}
      alt={altOf(alt, image)}
      sizes={TEXT_SIZES}
      className="inline-block h-auto max-w-full align-middle"
    />
  );
}

/** Whether a node shows anything: some text, or an image drawn or described. */
function showsSomething(
  node: Element | undefined,
  images: MarkdownImages,
): boolean {
  if (node === undefined) {
    return true;
  }
  return node.children.some((child) => {
    if (child.type === "text") {
      return child.value.trim() !== "";
    }
    if (child.type !== "element") {
      return false;
    }
    if (child.tagName !== "img") {
      return showsSomething(child, images);
    }
    const { src, alt } = child.properties;
    return (
      imageOf(src, images) !== undefined ||
      (typeof alt === "string" && alt.trim() !== "")
    );
  });
}

/** A paragraph holding one image and nothing else: its image element. */
function loneImage(node: Element | undefined): Element | undefined {
  const content = node?.children.filter(
    (child) => !(child.type === "text" && child.value.trim() === ""),
  );
  const [only] = content ?? [];
  return content?.length === 1 &&
    only?.type === "element" &&
    only.tagName === "img"
    ? only
    : undefined;
}

/**
 * An image alone in its paragraph: a figure when the Markdown title gives it
 * a caption, the image on its own otherwise. Never wider than it was stored.
 */
function BlockImage({
  element,
  images,
}: {
  readonly element: Element;
  readonly images: MarkdownImages;
}) {
  const { src, alt, title } = element.properties;
  const image = imageOf(src, images);
  if (image === undefined) {
    return typeof alt === "string" && alt.trim() !== "" ? <p>{alt}</p> : null;
  }
  const picture = (
    <MediaImage
      image={image}
      alt={altOf(alt, image)}
      sizes={TEXT_SIZES}
      className="border-line rounded-control h-auto max-w-full border"
    />
  );
  return typeof title === "string" && title.trim() !== "" ? (
    <figure className="flex flex-col gap-2">
      {picture}
      <figcaption className="text-fg-muted text-sm">{title}</figcaption>
    </figure>
  ) : (
    <p>{picture}</p>
  );
}

function isCallout(value: unknown): value is Exclude<CalloutKind, "details"> {
  return value === "note" || value === "warning";
}

/** The first element a rendered node holds: a callout's title, a summary. */
function firstElement(node: Element | undefined): Element | undefined {
  const first = node?.children.find((child) => child.type === "element");
  return first?.type === "element" ? first : undefined;
}

interface CalloutProps extends ChildrenProps {
  readonly kind: Exclude<CalloutKind, "details">;
  readonly node: Element | undefined;
  readonly labels: CalloutLabels;
}

/** A note or a warning, set apart from the text, titled by its kind if not by its author. */
function Callout({ kind, node, labels, children }: CalloutProps) {
  const hasTitle =
    firstElement(node)?.properties.dataCalloutTitle !== undefined;
  return (
    <div role="note" className="callout" data-callout={kind}>
      {!hasTitle && <p className="callout-title">{labels[kind]}</p>}
      {children}
    </div>
  );
}

interface DisclosureProps extends ChildrenProps {
  readonly node: Element | undefined;
  readonly labels: CalloutLabels;
}

/** A disclosure: its summary from the Markdown's label, else the page's word. */
function Disclosure({ node, labels, children }: DisclosureProps) {
  return (
    <details className="callout" data-callout="details">
      {firstElement(node)?.tagName !== "summary" && (
        <summary>{labels.details}</summary>
      )}
      {children}
    </details>
  );
}

interface ComponentOptions {
  readonly topLevel: TopLevel;
  readonly images: MarkdownImages;
  readonly labels: CalloutLabels;
}

/**
 * The components for one set of images, level and labels: built once, so a
 * re-render keeps them (a client preview would remount its images otherwise).
 */
const COMPONENTS = new WeakMap<MarkdownImages, Map<string, Components>>();

function componentsOf(options: ComponentOptions): Components {
  const { topLevel, images, labels } = options;
  const key = [topLevel, ...CALLOUT_KINDS.map((kind) => labels[kind])].join(
    "|",
  );
  const built = COMPONENTS.get(images);
  const cached = built?.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const components = componentsFor(options);
  COMPONENTS.set(images, new Map([...(built ?? []), [key, components]]));
  return components;
}

/** Shiki's class and colour variables: the only attributes a code block keeps. */
interface PreProps extends ChildrenProps {
  readonly className?: string;
  readonly style?: CSSProperties;
}

function componentsFor({
  topLevel,
  images,
  labels,
}: ComponentOptions): Components {
  return {
    h1: headingFor(topLevel, 1),
    h2: headingFor(topLevel, 2),
    h3: headingFor(topLevel, 3),
    h4: headingFor(topLevel, 4),
    h5: headingFor(topLevel, 5),
    h6: headingFor(topLevel, 6),
    // The library's images only (ADR-0007): an outside one, or one the
    // library no longer has, shows its description instead.
    p: ({ node, children }) => {
      if (node?.properties.dataCalloutTitle !== undefined) {
        return <p className="callout-title">{children}</p>;
      }
      const image = loneImage(node);
      return image === undefined ? (
        <p>{children}</p>
      ) : (
        <BlockImage element={image} images={images} />
      );
    },
    // Directives (ADR-0008): a callout, else a plain block around its content.
    div: ({ node, children }) => {
      const kind = node?.properties.dataCallout;
      return isCallout(kind) ? (
        <Callout kind={kind} node={node} labels={labels}>
          {children}
        </Callout>
      ) : (
        <div>{children}</div>
      );
    },
    details: ({ node, children }) => (
      <Disclosure node={node} labels={labels}>
        {children}
      </Disclosure>
    ),
    img: ({ src, alt }) => <InlineImage src={src} alt={alt} images={images} />,
    a: ({ node, href, children }) =>
      // A link left with nothing to show (an image without text) is dropped.
      !showsSomething(node, images) ? null : href === undefined ||
        href === "" ? (
        // safeMarkdownUrl empties an unsafe link: keep its text, drop the link.
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
    pre: ({ className, style, children }: PreProps) => (
      <pre className={className} style={style} tabIndex={0}>
        {children}
      </pre>
    ),
    table: ({ children }) => <table tabIndex={0}>{children}</table>,
  };
}

/** A src a page may show: one of the library's images, or a safe link. */
function markdownUrl(url: string, key: string): string {
  return key === "src" && mediaIdOf(url) !== undefined
    ? url
    : safeMarkdownUrl(url);
}

const NO_IMAGES: MarkdownImages = {};

/** Code lines longer than this are not coloured. */
const MAX_HIGHLIGHTED_LINE = 2000;

interface MarkdownProps {
  readonly source: string;
  /** The level Markdown's top headings take: right under the enclosing heading. */
  readonly topLevel?: TopLevel;
  /** The library's images the text shows (`media:<id>`), loaded with it. */
  readonly images?: MarkdownImages;
  /**
   * Gives the headings ids, for a table of contents: prefixed, so the copies
   * of the page other languages keep mounted never share one.
   */
  readonly headingIdPrefix?: string;
  /** Colours code blocks; without it, they stay plain. */
  readonly highlighter?: HighlighterCore;
  readonly labels?: CalloutLabels;
}

function rehypePluginsFor(
  headingIdPrefix: string | undefined,
  highlighter: HighlighterCore | undefined,
): PluggableList {
  const anchors: Pluggable = [rehypeSlug, { prefix: headingIdPrefix }];
  const colours: Pluggable = [
    rehypeShikiFromHighlighter,
    highlighter,
    {
      themes: CODE_THEMES,
      // Colours as CSS variables: the theme switch picks one set.
      defaultColor: false,
      defaultLanguage: "text",
      fallbackLanguage: "text",
      // A line past this is left plain: no pathological line holds a render.
      tokenizeMaxLineLength: MAX_HIGHLIGHTED_LINE,
    },
  ];
  return [
    ...(headingIdPrefix === undefined ? [] : [anchors]),
    ...(highlighter === undefined ? [] : [colours]),
  ];
}

/**
 * Renders stored Markdown (GFM) without raw HTML: tags in the source are
 * dropped, links only keep https, mailto and same-site URLs, images come from
 * the library only (`![text](media:<id> "Caption")`), and the only directives
 * are `:::note`, `:::warning` and `:::details` (ADR-0008).
 */
export function Markdown({
  source,
  topLevel = 3,
  images = NO_IMAGES,
  headingIdPrefix,
  highlighter,
  labels = FRENCH_LABELS,
}: MarkdownProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkDirective, remarkCallouts]}
        rehypePlugins={rehypePluginsFor(headingIdPrefix, highlighter)}
        // Footnotes' ids follow the headings': each copy of the page its own.
        remarkRehypeOptions={{
          clobberPrefix: headingIdPrefix ?? "user-content-",
        }}
        skipHtml
        urlTransform={markdownUrl}
        components={componentsOf({ topLevel, images, labels })}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
