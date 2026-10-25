import { describe, expect, it, vi } from "vitest";

import { createPathGate } from "./path-gate";
import type { SlugRegistry } from "./slug-registry";

function registry(answer: boolean | undefined): SlugRegistry {
  return { has: vi.fn(() => Promise.resolve(answer)) };
}

describe("createPathGate", () => {
  it("lets a known page through without asking for slugs", async () => {
    const slugs = registry(false);

    expect(await createPathGate(slugs).isKnown("/fr/projects")).toBe(true);
    expect(slugs.has).not.toHaveBeenCalled();
  });

  it("refuses an unknown route", async () => {
    expect(await createPathGate(registry(true)).isKnown("/fr/inconnu")).toBe(
      false,
    );
  });

  it("refuses a malformed slug without asking for slugs", async () => {
    const slugs = registry(true);

    expect(await createPathGate(slugs).isKnown("/fr/projects/D%C3%A9mo")).toBe(
      false,
    );
    expect(slugs.has).not.toHaveBeenCalled();
  });

  it.each([
    [true, true],
    [false, false],
    // Slugs unknown (database down): let the page decide, rather than 404 everything.
    [undefined, true],
  ])(
    "answers a well-formed slug from the registry (%s → %s)",
    async (answer, known) => {
      const slugs = registry(answer);

      expect(await createPathGate(slugs).isKnown("/en/experiences/acme")).toBe(
        known,
      );
      expect(slugs.has).toHaveBeenCalledWith("experiences", "acme");
    },
  );
});
