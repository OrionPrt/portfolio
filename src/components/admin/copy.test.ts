import { describe, expect, it } from "vitest";

import { ADMIN_COPY } from "./copy";

/** Every string of the copy, however deep. */
function stringsOf(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  return typeof value === "object" && value !== null
    ? Object.values(value).flatMap(stringsOf)
    : [];
}

describe("ADMIN_COPY", () => {
  it("uses French spacing before high punctuation", () => {
    for (const text of stringsOf(ADMIN_COPY)) {
      expect(text).not.toMatch(/ [?!;:]/);
    }
  });
});
