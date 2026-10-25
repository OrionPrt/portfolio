import { describe, expect, it } from "vitest";

import {
  experienceTransitionName,
  projectTransitionName,
  skillAnchor,
  VIEW_TRANSITIONS,
} from "./view-names";

describe("view-transition names", () => {
  it("pair a tile with its full-screen view under one name per entry", () => {
    expect(projectTransitionName("demo")).toBe("project-demo");
    expect(experienceTransitionName("acme")).toBe("experience-acme");
    expect(projectTransitionName("a")).not.toBe(projectTransitionName("b"));
  });

  it("never collide between the hub's fixed views and the entries", () => {
    const fixed = Object.values(VIEW_TRANSITIONS);

    expect(new Set(fixed).size).toBe(fixed.length);
    expect(fixed).not.toContain(projectTransitionName("identity"));
  });
});

describe("skillAnchor", () => {
  // Cache Components keeps the other locale's page mounted: ids carry the locale.
  it("is unique per skill and per locale", () => {
    expect(skillAnchor("rust", "fr")).toBe("skill-rust-fr");
    expect(skillAnchor("rust", "en")).not.toBe(skillAnchor("rust", "fr"));
  });
});
