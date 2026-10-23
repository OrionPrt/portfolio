import { describe, expect, it } from "vitest";

import { isSlug, MAX_SLUG_LENGTH } from "./slug";

describe("isSlug", () => {
  it.each(["demo", "my-project-2", "a", "a".repeat(MAX_SLUG_LENGTH)])(
    "accepts %j",
    (value) => {
      expect(isSlug(value)).toBe(true);
    },
  );

  it.each([
    "",
    "Demo",
    "demo project",
    "-demo",
    "demo-",
    "demo--x",
    "démo",
    "../etc",
    "a".repeat(MAX_SLUG_LENGTH + 1),
  ])("rejects %j", (value) => {
    expect(isSlug(value)).toBe(false);
  });
});
