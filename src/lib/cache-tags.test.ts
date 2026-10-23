import { describe, expect, it } from "vitest";

import { CACHE_TAGS, experienceTag, projectTag } from "./cache-tags";
import { MAX_SLUG_LENGTH } from "./slug";

// Next.js ignores, with a warning, any tag longer than this.
const NEXT_MAX_TAG_LENGTH = 256;

describe("cache tags", () => {
  it("are all distinct", () => {
    const tags = Object.values(CACHE_TAGS);

    expect(new Set(tags).size).toBe(tags.length);
  });

  it("name one entity by its slug", () => {
    expect(projectTag("demo")).toBe("project:demo");
    expect(experienceTag("acme")).toBe("experience:acme");
  });

  it("stay within the Next.js tag length for the longest slug", () => {
    const longest = "a".repeat(MAX_SLUG_LENGTH);

    expect(experienceTag(longest).length).toBeLessThanOrEqual(
      NEXT_MAX_TAG_LENGTH,
    );
  });
});
