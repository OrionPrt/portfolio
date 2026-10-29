import { describe, expect, it } from "vitest";

import { profileView, projectView } from "../../../test/fixtures/views";
import { tileContent, tilesWithoutContent } from "./tile-content";

const NOTHING = {
  profile: undefined,
  featuredProject: undefined,
  currentExperience: undefined,
  skills: [],
  education: [],
  certifications: [],
};

describe("tilesWithoutContent", () => {
  it("names every tile the hub would leave out, never the identity or the contact", () => {
    expect(tilesWithoutContent(NOTHING)).toEqual([
      "featured_project",
      "current_experience",
      "stack",
      "cyber_stats",
      "certifications",
    ]);
  });

  it("shows the journey tile for an education alone, as for a certification", () => {
    const content = {
      ...NOTHING,
      education: [
        {
          slug: "epitech",
          school: "Epitech",
          location: null,
          startedOn: "2021-09-01",
          endedOn: null,
          degree: "Expert en technologies de l'information",
          description: "",
          logo: undefined,
          isFallback: false,
          contentLocale: "fr" as const,
        },
      ],
    };

    expect(tilesWithoutContent(content)).not.toContain("certifications");
    expect(tileContent("certifications", content)).toEqual({
      kind: "certifications",
      education: content.education,
      certifications: [],
    });
  });

  it("keeps a tile once it has something to show", () => {
    const content = {
      ...NOTHING,
      featuredProject: projectView(),
      profile: profileView({
        socialLinks: [{ kind: "rootme", url: "https://www.root-me.org/me" }],
      }),
    };

    expect(tilesWithoutContent(content)).toEqual([
      "current_experience",
      "stack",
      "certifications",
    ]);
    expect(tileContent("cyber_stats", content)).toEqual({
      kind: "cyber_stats",
      links: [{ kind: "rootme", url: "https://www.root-me.org/me" }],
    });
  });
});
