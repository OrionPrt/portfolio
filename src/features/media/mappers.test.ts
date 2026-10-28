import { describe, expect, it } from "vitest";

import { toMediaView, type MediaRow } from "./mappers";

const ROW: MediaRow = {
  id: "m-1",
  sha256: "a".repeat(64),
  pathname: "media/m-1",
  width: 960,
  height: 540,
  variants: [{ width: 960, height: 540, url: "/m/960.webp", bytes: 1 }],
  createdAt: new Date(),
  updatedAt: new Date(),
  translations: [
    { mediaId: "m-1", locale: "fr", alt: "Tableau de bord" },
    { mediaId: "m-1", locale: "en", alt: "Dashboard" },
  ],
};

describe("toMediaView", () => {
  it("gives an image its text in the page's language", () => {
    expect(toMediaView(ROW, "en")).toEqual({
      alt: "Dashboard",
      width: 960,
      height: 540,
      variants: ROW.variants,
    });
  });

  it("falls back on the other language, and reads no image as none", () => {
    const frenchOnly = ROW.translations.filter((text) => text.locale === "fr");

    expect(toMediaView({ ...ROW, translations: frenchOnly }, "en")?.alt).toBe(
      "Tableau de bord",
    );
    expect(toMediaView(null, "fr")).toBeUndefined();
  });
});
