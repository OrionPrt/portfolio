import { describe, expect, it } from "vitest";

import { insertBlock } from "./markdown-insert";

const IMAGE = "![x](media:id)";

describe("insertBlock", () => {
  it.each([
    ["into an empty text", "", 0, 0, `${IMAGE}\n`],
    ["after a paragraph", "Intro.", 6, 6, `Intro.\n\n${IMAGE}\n`],
    ["after a line break", "Intro.\n", 7, 7, `Intro.\n\n${IMAGE}\n`],
    [
      "between two paragraphs",
      "One.\n\nTwo.",
      6,
      6,
      `One.\n\n${IMAGE}\n\nTwo.`,
    ],
    [
      "within a sentence, splitting it",
      "Avant après.",
      6,
      6,
      `Avant \n\n${IMAGE}\n\naprès.`,
    ],
    ["over a selection, replacing it", "A old B", 2, 5, `A \n\n${IMAGE}\n\n B`],
  ])(
    "puts the block on lines of its own %s",
    (_, text, start, end, expected) => {
      expect(insertBlock(text, start, end, IMAGE).text).toBe(expected);
    },
  );

  it("leaves the caret right after the block", () => {
    const { text, caret } = insertBlock("One.\n\nTwo.", 6, 6, IMAGE);

    expect(text.slice(0, caret)).toBe(`One.\n\n${IMAGE}\n\n`);
  });
});
