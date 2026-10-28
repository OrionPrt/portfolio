import { describe, expect, it } from "vitest";

import { tagsFor } from "./content-tags";

describe("tagsFor", () => {
  it.each([
    [{ entity: "profile" }, ["profile"]],
    // Social links are read with the profile.
    [{ entity: "social_link" }, ["profile"]],
    // Project and experience reads carry `skills` too: their badges follow.
    [{ entity: "skill" }, ["skills"]],
    [{ entity: "education" }, ["education"]],
    [{ entity: "certification" }, ["certifications"]],
    [{ entity: "bento_tile" }, ["bento"]],
    [{ entity: "media" }, ["media"]],
  ] as const)("invalidates %j through %j", (change, tags) => {
    expect(tagsFor(change)).toEqual(tags);
  });

  it("invalidates the list and each page of a project or an experience, both slugs on a rename", () => {
    expect(tagsFor({ entity: "project", slugs: ["new", "old"] })).toEqual([
      "projects",
      "project:new",
      "project:old",
    ]);
    expect(tagsFor({ entity: "experience", slugs: ["acme"] })).toEqual([
      "experiences",
      "experience:acme",
    ]);
  });

  it("names each tag once", () => {
    expect(tagsFor({ entity: "project", slugs: ["same", "same"] })).toEqual([
      "projects",
      "project:same",
    ]);
  });
});
