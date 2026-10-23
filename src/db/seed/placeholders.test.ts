import { describe, expect, it } from "vitest";

import { countPlaceholders, PLACEHOLDER } from "./placeholders";

describe("countPlaceholders", () => {
  it("counts every placeholder left in the content, however deep", () => {
    const content = {
      profile: { pitch: `${PLACEHOLDER} pitch` },
      projects: [{ title: PLACEHOLDER, tagline: `a ${PLACEHOLDER} b` }],
    };

    expect(countPlaceholders(content)).toBe(3);
  });

  it("finds none in finished content", () => {
    expect(countPlaceholders({ title: "Done" })).toBe(0);
  });
});
