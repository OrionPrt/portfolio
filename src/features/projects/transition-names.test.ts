import { describe, expect, it } from "vitest";

import { projectTransitionName } from "./transition-names";

describe("projectTransitionName", () => {
  it("pairs a project tile with its detail view under one view-transition name", () => {
    expect(projectTransitionName("demo")).toBe("project-demo");
  });

  it("gives every project its own name", () => {
    expect(projectTransitionName("a")).not.toBe(projectTransitionName("b"));
  });
});
