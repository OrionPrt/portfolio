import { describe, expect, it } from "vitest";

import { localizedAlternates } from "./alternates";

describe("localizedAlternates", () => {
  it("points the canonical URL at the page itself, and lists every language", () => {
    expect(
      localizedAlternates("en", {
        pathname: "/projects/[slug]",
        params: { slug: "portfolio" },
      }),
    ).toEqual({
      canonical: "/en/projects/portfolio",
      languages: {
        fr: "/fr/projets/portfolio",
        en: "/en/projects/portfolio",
        "x-default": "/fr/projets/portfolio",
      },
    });
  });
});
