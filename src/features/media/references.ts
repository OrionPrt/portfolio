// Free of server code: the Markdown editor writes references, the renderer reads them.

const SCHEME = "media:";

/** The images one text may show at most: the rest show their description. */
export const MAX_IMAGES_PER_TEXT = 30;

/** A whole reference: an image's src in Markdown (the ids are lower-case). */
const REFERENCE =
  /^media:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/**
 * Every reference a text holds, written plainly. The renderer would also
 * read an escaped form (`media\\:…`): such an image is never loaded for the
 * page, so it shows its description, and nothing it draws escapes the
 * deletion guard, which looks for the plain form too.
 */
const REFERENCES =
  /media:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;

/** How Markdown names an image of the library: resolved when the page renders. */
export function mediaReference(id: string): string {
  return `${SCHEME}${id}`;
}

/** The image a Markdown src names, if it names one of the library. */
export function mediaIdOf(url: string): string | undefined {
  return REFERENCE.exec(url)?.[1];
}

/** The images a text shows, each once, in their order. */
export function mediaIdsIn(markdown: string): readonly string[] {
  return [
    ...new Set(
      [...markdown.matchAll(REFERENCES)].flatMap(([, id]) => id ?? []),
    ),
  ];
}

/** The images a page loads for its text: the first ones, sorted into one cache key. */
export function imagesToLoad(markdown: string, max: number): readonly string[] {
  return mediaIdsIn(markdown).slice(0, max).toSorted();
}

/** An image as Markdown: `![text](media:<id>)`, on one line, its brackets escaped. */
export function markdownImage(id: string, alt: string): string {
  const text = alt
    .replace(/\s+/g, " ")
    .replace(/[\\[\]]/g, (character) => `\\${character}`);
  return `![${text}](${mediaReference(id)})`;
}
