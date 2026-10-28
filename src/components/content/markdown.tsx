import type { ReactNode } from "react";
import ReactMarkdown, {
  type Components,
  type ExtraProps,
} from "react-markdown";
import remarkGfm from "remark-gfm";

import { MediaImage } from "@/components/ui/media-image";
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

/** The components for one set of images: built once per set, so a re-render keeps them. */
const COMPONENTS = new WeakMap<
  MarkdownImages,
  Partial<Record<TopLevel, Components>>
>();

function componentsOf(topLevel: TopLevel, images: MarkdownImages): Components {
  const built = COMPONENTS.get(images) ?? {};
  const components = built[topLevel] ?? componentsFor(topLevel, images);
  COMPONENTS.set(images, { ...built, [topLevel]: components });
  return components;
}

function componentsFor(topLevel: TopLevel, images: MarkdownImages): Components {
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
      const image = loneImage(node);
      return image === undefined ? (
        <p>{children}</p>
      ) : (
        <BlockImage element={image} images={images} />
      );
    },
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
    pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
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

interface MarkdownProps {
  readonly source: string;
  /** The level Markdown's top headings take: right under the enclosing heading. */
  readonly topLevel?: TopLevel;
  /** The library's images the text shows (`media:<id>`), loaded with it. */
  readonly images?: MarkdownImages;
}

/**
 * Renders stored Markdown (GFM) without raw HTML: tags in the source are
 * dropped, links only keep https, mailto and same-site URLs, and images come
 * from the library only (`![text](media:<id> "Caption")`).
 */
export function Markdown({
  source,
  topLevel = 3,
  images = NO_IMAGES,
}: MarkdownProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={markdownUrl}
        components={componentsOf(topLevel, images)}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
