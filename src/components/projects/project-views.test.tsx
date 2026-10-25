import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { projectView } from "../../../test/fixtures/views";
import { renderWithIntl } from "../../../test/render";
import { ProjectCard } from "./project-card";
import { ProjectDetail } from "./project-detail";
import { ProjectFiltersForm } from "./project-filters-form";

describe("ProjectDetail", () => {
  it("shows the project, its links, period and technologies", () => {
    renderWithIntl(
      <ProjectDetail
        project={projectView({
          repoUrl: "https://github.com/OrionPrt/portfolio",
          demoUrl: "https://orion.dev",
          startedOn: "2026-10-01",
          skills: [{ slug: "nextjs", name: "Next.js" }],
        })}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Ce portfolio",
    );
    expect(screen.getByRole("link", { name: "Code source" })).toHaveAttribute(
      "href",
      "https://github.com/OrionPrt/portfolio",
    );
    expect(screen.getByRole("link", { name: "Démo" })).toBeVisible();
    expect(screen.getByText(/octobre 2026/)).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "Technologies" })).getByRole(
        "link",
        {
          name: "Next.js",
        },
      ),
    ).toHaveAttribute("href", "/fr/competences#skill-nextjs-fr");
    expect(
      screen.getByRole("link", { name: /Retour à l'accueil/ }),
    ).toHaveAttribute("href", "/fr");
  });

  it("marks content shown in another language", () => {
    renderWithIntl(
      <ProjectDetail
        project={projectView({ isFallback: true, contentLocale: "fr" })}
      />,
      "en",
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute(
      "lang",
      "fr",
    );
    // Interface labels stay in the page's language.
    expect(screen.getByText("project").closest("[lang]")).toBeNull();
  });

  it("leaves out what the project does not have", () => {
    renderWithIntl(<ProjectDetail project={projectView()} />);

    expect(screen.queryByRole("link", { name: "Code source" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Technologies" })).toBeNull();
  });
});

describe("ProjectCard", () => {
  it("links the whole card to the project, through its title", () => {
    renderWithIntl(<ProjectCard project={projectView()} />, "en");

    expect(screen.getByRole("link", { name: "Ce portfolio" })).toHaveAttribute(
      "href",
      "/en/projects/portfolio",
    );
    expect(screen.getByText("web")).toBeVisible();
  });
});

describe("ProjectFiltersForm", () => {
  const skills = [{ slug: "rust", name: "Rust" }];

  it("is a GET form showing the current filters", () => {
    renderWithIntl(
      <ProjectFiltersForm
        filters={{ domain: "cyber", skill: "rust" }}
        domains={["web", "cyber"]}
        skills={skills}
      />,
    );

    expect(
      screen.getByRole("search", { name: "Filtrer les projets" }),
    ).toHaveAttribute("method", "get");
    expect(screen.getByLabelText("Domaine")).toHaveValue("cyber");
    expect(screen.getByLabelText("Technologie")).toHaveValue("rust");
    expect(screen.getByRole("link", { name: "Tout afficher" })).toHaveAttribute(
      "href",
      "/fr/projets",
    );
  });

  it("offers no reset when nothing is filtered", () => {
    renderWithIntl(
      <ProjectFiltersForm filters={{}} domains={["web"]} skills={skills} />,
    );

    expect(screen.getByLabelText("Domaine")).toHaveValue("");
    expect(screen.queryByRole("link", { name: "Tout afficher" })).toBeNull();
  });
});
