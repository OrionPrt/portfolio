import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "../../../test/render";
import { SkillsView } from "./skills-view";

const SKILLS = [
  { slug: "react", name: "React", domain: "web", featured: true },
  { slug: "angular", name: "Angular", domain: "web", featured: false },
  { slug: "kerberos", name: "Kerberos", domain: "cyber", featured: false },
] as const;

const USAGE = new Map([
  [
    "react",
    {
      projects: [{ slug: "site", title: "Site" }],
      experiences: [{ slug: "acme", role: "Dev", company: "Acme" }],
    },
  ],
]);

describe("SkillsView", () => {
  it("groups skills by domain and links each one to where it was used", () => {
    renderWithIntl(<SkillsView skills={SKILLS} usage={USAGE} />);
    const web = screen.getByRole("region", { name: "Développement web" });

    expect(within(web).getByRole("link", { name: "Site" })).toHaveAttribute(
      "href",
      "/fr/projets/site",
    );
    expect(
      within(web).getByRole("link", { name: "Dev — Acme" }),
    ).toHaveAttribute("href", "/fr/experiences/acme");
    expect(screen.getByRole("region", { name: "Cybersécurité" })).toBeVisible();
  });

  it("anchors every skill, used or not, for the skill badges", () => {
    const { container } = renderWithIntl(
      <SkillsView skills={SKILLS} usage={USAGE} />,
    );

    expect(container.querySelector("#skill-react-fr")).toHaveTextContent(
      "React",
    );
    expect(container.querySelector("#skill-angular-fr")).toHaveTextContent(
      "Angular",
    );
    expect(
      screen.getAllByText("Pas encore reliées à un projet publié :"),
    ).toHaveLength(2);
  });
});
