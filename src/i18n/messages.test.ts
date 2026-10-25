import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

/** Every leaf key, as a dotted path. */
function keysOf(messages: object, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? keysOf(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("message catalogs", () => {
  it("define the same keys in every language", () => {
    expect(keysOf(en).sort()).toEqual(keysOf(fr).sort());
  });

  it("use French spacing before high punctuation", () => {
    const french = JSON.stringify(fr);

    expect(french).not.toMatch(/ [?!;:]/);
  });
});
