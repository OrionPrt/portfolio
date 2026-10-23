import { describe, expect, it } from "vitest";

import {
  findPlaceholderProject,
  PLACEHOLDER_PROJECTS,
} from "./placeholder-projects";

describe("placeholder projects", () => {
  it("exposes the featured demo project used by the bento prototype", () => {
    expect(PLACEHOLDER_PROJECTS.map((project) => project.slug)).toContain(
      "demo",
    );
  });

  it("finds a project by its slug", () => {
    expect(findPlaceholderProject("demo")?.slug).toBe("demo");
  });

  it("returns undefined for an unknown slug", () => {
    expect(findPlaceholderProject("does-not-exist")).toBeUndefined();
  });
});
