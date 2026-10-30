import { describe, expect, it } from "vitest";

import { sitemapEntries } from "./sitemap-entries";

describe("sitemapEntries", () => {
  const entries = sitemapEntries(new URL("https://orion.dev"), {
    projects: ["portfolio"],
    experiences: ["acme"],
  });

  it("lists every page and published entry once, under its French URL", () => {
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://orion.dev/fr",
      "https://orion.dev/fr/a-propos",
      "https://orion.dev/fr/competences",
      "https://orion.dev/fr/projets",
      "https://orion.dev/fr/experiences",
      "https://orion.dev/fr/contact",
      "https://orion.dev/fr/projets/portfolio",
      "https://orion.dev/fr/experiences/acme",
    ]);
  });

  it("links each URL to its other languages", () => {
    expect(entries[6]?.alternates?.languages).toEqual({
      fr: "https://orion.dev/fr/projets/portfolio",
      en: "https://orion.dev/en/projects/portfolio",
    });
  });
});
