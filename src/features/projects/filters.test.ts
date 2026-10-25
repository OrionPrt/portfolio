import { describe, expect, it } from "vitest";

import { filterProjects, parseProjectFilters, skillsUsedBy } from "./filters";
import type { ProjectView } from "./types";

function project(
  slug: string,
  domain: ProjectView["domain"],
  skills: readonly string[],
): ProjectView {
  return {
    slug,
    domain,
    featured: false,
    repoUrl: null,
    demoUrl: null,
    startedOn: null,
    endedOn: null,
    title: slug,
    tagline: "",
    summary: { context: "", action: "", result: "" },
    technicalMd: "",
    seoDescription: null,
    skills: skills.map((name) => ({ slug: name, name: name.toUpperCase() })),
    isFallback: false,
    contentLocale: "fr",
  };
}

const PROJECTS = [
  project("site", "web", ["typescript", "react"]),
  project("shell", "low_level", ["c"]),
  project("ad-lab", "cyber", ["kerberos", "c"]),
];

describe("parseProjectFilters", () => {
  it("reads a known domain and a well-formed skill from the URL", () => {
    expect(parseProjectFilters({ domain: "cyber", skill: "c" })).toEqual({
      domain: "cyber",
      skill: "c",
    });
  });

  it.each([
    [{}, {}],
    [{ domain: "space", skill: "Bad Skill" }, {}],
    [{ domain: ["web", "cyber"] }, {}],
    [{ domain: "", skill: "" }, {}],
  ])("ignores what it cannot use: %j", (searchParams, expected) => {
    expect(parseProjectFilters(searchParams)).toEqual(expected);
  });
});

describe("filterProjects", () => {
  it("keeps the projects matching every filter given", () => {
    expect(filterProjects(PROJECTS, { skill: "c" }).map((p) => p.slug)).toEqual(
      ["shell", "ad-lab"],
    );
    expect(
      filterProjects(PROJECTS, { domain: "cyber", skill: "c" }).map(
        (p) => p.slug,
      ),
    ).toEqual(["ad-lab"]);
    expect(filterProjects(PROJECTS, {})).toEqual(PROJECTS);
  });
});

describe("skillsUsedBy", () => {
  it("lists each skill once, sorted by name", () => {
    expect(skillsUsedBy(PROJECTS).map((skill) => skill.slug)).toEqual([
      "c",
      "kerberos",
      "react",
      "typescript",
    ]);
  });
});
