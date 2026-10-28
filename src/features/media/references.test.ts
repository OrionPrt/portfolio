import { describe, expect, it } from "vitest";

import {
  imagesToLoad,
  markdownImage,
  mediaIdOf,
  mediaIdsIn,
  mediaReference,
} from "./references";

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const OTHER = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

describe("media references", () => {
  it("names an image of the library, and reads its id back", () => {
    expect(mediaReference(ID)).toBe(`media:${ID}`);
    expect(mediaIdOf(`media:${ID}`)).toBe(ID);
  });

  it.each([
    `media:${ID.toUpperCase()}`,
    `media:${ID}/480.webp`,
    "media:not-an-id",
    `https://example.com/media:${ID}`,
    "",
  ])("reads no id in %j", (url) => {
    expect(mediaIdOf(url)).toBeUndefined();
  });

  it("finds every image a text shows, once each, in order", () => {
    const text = `Intro ![a](media:${ID}) then ![b](media:${OTHER} "Légende")
and ![again](media:${ID}), but not media:${ID.toUpperCase()} or [link](media:nope).`;

    expect(mediaIdsIn(text)).toEqual([ID, OTHER]);
    expect(mediaIdsIn("No image here.")).toEqual([]);
  });

  it("loads the first images of a text in its order, sorted into one cache key", () => {
    const ids = Array.from(
      { length: 4 },
      (_, index) =>
        `${String(4 - index).padStart(8, "0")}-0000-4000-8000-000000000000`,
    );
    const text = ids.map((id) => `![x](media:${id})`).join("\n");

    // The fourth, though smallest, is the one past the limit.
    expect(imagesToLoad(text, 3)).toEqual([...ids.slice(0, 3)].sort());
  });

  it("keeps an image's Markdown on one line, whatever its text", () => {
    expect(markdownImage(ID, "Le schéma\n  en deux\r\nlignes")).toBe(
      `![Le schéma en deux lignes](media:${ID})`,
    );
  });

  it("writes an image's Markdown, its text escaped", () => {
    expect(markdownImage(ID, "Le schéma [v2] \\ final")).toBe(
      `![Le schéma \\[v2\\] \\\\ final](media:${ID})`,
    );
  });
});
