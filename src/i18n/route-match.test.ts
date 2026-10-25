import { describe, expect, it } from "vitest";

import { matchRoute } from "./route-match";

describe("matchRoute", () => {
  it.each([
    ["/fr", "fr"],
    ["/en/", "en"],
    ["/fr/about", "fr"],
    ["/en/skills", "en"],
    ["/fr/projects", "fr"],
    ["/en/experiences", "en"],
  ])("knows the page %s", (pathname, locale) => {
    expect(matchRoute(pathname)).toEqual({ kind: "page", locale });
  });

  it.each([
    ["/fr/projects/portfolio", "fr", "projects", "portfolio"],
    ["/en/experiences/acme-2024", "en", "experiences", "acme-2024"],
    // Decoded, then judged by the slug rules downstream.
    ["/fr/projects/D%C3%A9mo", "fr", "projects", "Démo"],
  ])("reads the entry %s", (pathname, locale, collection, slug) => {
    expect(matchRoute(pathname)).toEqual({
      kind: "entry",
      locale,
      collection,
      slug,
    });
  });

  it.each([
    ["/fr/inconnu", "fr"],
    ["/fr/projects/portfolio/extra", "fr"],
    ["/fr/projets", "fr"],
    ["/fr/projects/%E0%A4%A", "fr"],
    ["/de/projects", undefined],
    ["/", undefined],
  ])("does not know %s", (pathname, locale) => {
    expect(matchRoute(pathname)).toEqual({ kind: "unknown", locale });
  });
});
