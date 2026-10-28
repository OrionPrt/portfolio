import { describe, expect, it } from "vitest";

import { isSlug, MAX_SLUG_LENGTH, slugify } from "./slug";

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

describe("slugify", () => {
  it.each([
    ["OSCP", "oscp"],
    ["Diplôme d'ingénieur — INSA Lyon", "diplome-d-ingenieur-insa-lyon"],
    [
      "  AWS  Certified: Solutions Architect (SAA-C03)  ",
      "aws-certified-solutions-architect-saa-c03",
    ],
    ["Ærø Straße œuvre", "aero-strasse-oeuvre"],
    ["ＯＳＣＰ ﬁnance", "oscp-finance"],
  ])("turns %j into %j", (text, slug) => {
    expect(slugify(text)).toBe(slug);
  });

  it("stays within the length, never ending on a hyphen", () => {
    const slug = slugify("word ".repeat(30));

    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(isSlug(slug)).toBe(true);
  });

  it("has a word to fall back on when nothing is left", () => {
    expect(slugify("— ! —")).toBe("entree");
    expect(slugify("日本語")).toBe("entree");
  });
});
