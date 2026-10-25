import { describe, expect, it } from "vitest";

import type { SkillView } from "@/features/catalog/repository";

import { groupSkillsByDomain, highlightSkills } from "./skill-groups";

function skill(slug: string, domain: SkillView["domain"], featured = false) {
  return { slug, name: slug.toUpperCase(), domain, featured };
}

const SKILLS = [
  skill("ts", "web", true),
  skill("react", "web"),
  skill("next", "web", true),
  skill("css", "web"),
  skill("kerberos", "cyber"),
];

describe("groupSkillsByDomain", () => {
  it("keeps the domain order and leaves out empty domains", () => {
    expect(
      groupSkillsByDomain(SKILLS).map(({ domain, skills }) => [
        domain,
        skills.map((s) => s.slug),
      ]),
    ).toEqual([
      ["web", ["ts", "react", "next", "css"]],
      ["cyber", ["kerberos"]],
    ]);
  });
});

describe("highlightSkills", () => {
  it("shows the featured skills first and counts the others", () => {
    expect(highlightSkills(SKILLS.slice(0, 4), 2)).toEqual({
      shown: [SKILLS[0], SKILLS[2]],
      hidden: 2,
    });
  });

  it("falls back to the first skills when none is featured", () => {
    expect(highlightSkills([skill("a", "web"), skill("b", "web")], 1)).toEqual({
      shown: [skill("a", "web")],
      hidden: 1,
    });
  });
});
