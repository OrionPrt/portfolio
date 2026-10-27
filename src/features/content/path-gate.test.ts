import { describe, expect, it, vi } from "vitest";

import { createPathGate } from "./path-gate";
import type { SlugRegistry, SlugResolution } from "./slug-registry";

function registry(answer: SlugResolution | undefined): SlugRegistry {
  return { resolve: vi.fn(() => Promise.resolve(answer)) };
}

describe("createPathGate", () => {
  it("lets a known page through without asking for slugs", async () => {
    const slugs = registry({ kind: "missing" });

    expect(await createPathGate(slugs).check("/fr/projects")).toEqual({
      kind: "known",
    });
    expect(slugs.resolve).not.toHaveBeenCalled();
  });

  it("refuses an unknown route", async () => {
    expect(
      await createPathGate(registry({ kind: "published" })).check(
        "/fr/inconnu",
      ),
    ).toEqual({ kind: "unknown" });
  });

  it("refuses a malformed slug without asking for slugs", async () => {
    const slugs = registry({ kind: "published" });

    expect(await createPathGate(slugs).check("/fr/projects/D%C3%A9mo")).toEqual(
      { kind: "unknown" },
    );
    expect(slugs.resolve).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: "published" }, { kind: "known" }],
    [{ kind: "missing" }, { kind: "unknown" }],
    [
      { kind: "redirect", to: "new-acme" },
      { kind: "redirect", slug: "new-acme" },
    ],
    // Slugs unknown (database down): let the page decide, rather than 404 everything.
    [undefined, { kind: "known" }],
  ] as const)(
    "answers a well-formed slug from the registry (%j → %j)",
    async (answer, outcome) => {
      const slugs = registry(answer);

      expect(await createPathGate(slugs).check("/en/experiences/acme")).toEqual(
        outcome,
      );
      expect(slugs.resolve).toHaveBeenCalledWith("experiences", "acme");
    },
  );
});
