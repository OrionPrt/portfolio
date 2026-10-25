import { describe, expect, it } from "vitest";

import { skillUsage } from "./skill-usage";

describe("skillUsage", () => {
  it("links each skill to the projects and experiences that use it", () => {
    const usage = skillUsage(
      [
        {
          slug: "site",
          title: "Site",
          isFallback: true,
          contentLocale: "fr",
          skills: [{ slug: "react", name: "React" }],
        },
        { slug: "cli", title: "CLI", skills: [{ slug: "rust", name: "Rust" }] },
      ],
      [
        {
          slug: "acme",
          role: "Dev",
          company: "Acme",
          skills: [{ slug: "react", name: "React" }],
        },
      ],
    );

    expect(usage.get("react")).toEqual({
      projects: [{ slug: "site", title: "Site", lang: "fr" }],
      experiences: [{ slug: "acme", role: "Dev", company: "Acme" }],
    });
    expect(usage.get("rust")?.experiences).toEqual([]);
    expect(usage.get("go")).toBeUndefined();
  });
});
