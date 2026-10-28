import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ContentFormState } from "@/features/admin/content-form-state";
import type { ProjectForEdit } from "@/features/projects/admin-repository";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/experiences/admin-actions", () => ({
  createExperienceAction: vi.fn(),
  updateExperienceAction: vi.fn(),
  deleteExperienceAction: vi.fn(),
}));
vi.mock("@/features/projects/admin-actions", () => ({
  createProjectAction: vi.fn(),
  updateProjectAction: vi.fn(),
  moveProjectAction: vi.fn(),
  deleteProjectAction: vi.fn(),
}));

import { regionWith } from "../../../../test/dom";
import { ExperienceForm } from "./experience-form";
import { ExperienceList } from "./experience-list";
import { ProjectForm } from "./project-form";
import { ProjectList } from "./project-list";

const SKILLS = [
  { slug: "react", name: "React", domain: "web" },
  { slug: "rust", name: "Rust", domain: "low_level" },
] as const;

const PROJECT: ProjectForEdit = {
  id: "p-1",
  slug: "demo",
  domain: "low_level",
  status: "published",
  featured: true,
  sortOrder: 0,
  repoUrl: "https://github.com/orion/demo",
  demoUrl: null,
  coverMediaId: null,
  startedOn: "2024-01-01",
  endedOn: null,
  skills: ["rust"],
  translations: {
    fr: {
      title: "Démo",
      tagline: "Accroche",
      summaryContext: "Contexte",
      summaryAction: "Action",
      summaryResult: "Résultat",
      technicalMd: "",
      seoDescription: null,
    },
  },
};

describe("ProjectList", () => {
  it("shows the featured projects apart, each with what it still lacks", () => {
    render(
      <ProjectList
        projects={[
          {
            id: "p-1",
            slug: "demo",
            status: "published",
            featured: true,
            title: "Démo",
            english: "complete",
          },
          {
            id: "p-2",
            slug: "draft",
            status: "draft",
            featured: true,
            title: "Brouillon de projet",
            english: "missing",
          },
        ]}
      />,
    );

    const featured = screen.getByRole("region", { name: "Mis en avant" });
    const [demo, draft] = within(featured).getAllByRole("listitem");
    expect(demo).not.toHaveTextContent("Brouillon");
    expect(draft).toHaveTextContent("Brouillon de projet Brouillon");
    expect(draft).toHaveTextContent("Anglais à traduire");
    expect(
      within(demo ?? document.body).getByRole("button", {
        name: "Monter Démo",
      }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      within(demo ?? document.body).getByRole("link", {
        name: "Modifier Démo",
      }),
    ).toHaveAttribute("href", "/admin/projects/p-1");
    expect(
      within(screen.getByRole("region", { name: "Autres projets" })).getByText(
        "Aucun autre projet.",
      ),
    ).toBeInTheDocument();
  });
});

describe("ProjectForm", () => {
  it("starts a new project as a draft, with no skill linked", () => {
    const { container } = render(
      <ProjectForm action={vi.fn()} skills={SKILLS} media={[]} />,
    );

    expect(screen.getByLabelText("Statut")).toHaveValue("draft");
    expect(screen.getByLabelText("Domaine")).toHaveValue("web");
    expect(screen.getByText("Aucune compétence liée.")).toBeInTheDocument();
    expect(container.querySelector("input[name=id]")).toBeNull();
  });

  it("starts from the project to edit, by parts", () => {
    const { container } = render(
      <ProjectForm
        action={vi.fn()}
        project={PROJECT}
        skills={SKILLS}
        media={[]}
      />,
    );

    const publication = screen.getByRole("group", { name: "Publication" });
    expect(within(publication).getByLabelText("Statut")).toHaveValue(
      "published",
    );
    expect(within(publication).getByLabelText("Mise en avant")).toBeChecked();
    const title = screen.getByRole("group", { name: "Titre" });
    expect(within(title).getByLabelText("Français")).toHaveValue("Démo");
    expect(screen.getByLabelText("Dépôt de code")).toHaveValue(
      "https://github.com/orion/demo",
    );
    expect(screen.getByLabelText("Début")).toHaveValue("2024-01-01");
    expect(
      within(
        screen.getByRole("group", { name: "Compétences liées" }),
      ).getByRole("listitem"),
    ).toHaveTextContent("Rust");
    expect(container.querySelector("input[name=id]")).toHaveValue("p-1");
  });

  it("after a refusal, still flags the English to translate next to the French sent", async () => {
    const user = userEvent.setup();
    const save =
      vi.fn<
        (state: ContentFormState, data: FormData) => Promise<ContentFormState>
      >();
    save.mockResolvedValue({ status: "invalid", problems: {} });
    const { container } = render(
      <ProjectForm action={save} skills={SKILLS} media={[]} />,
    );
    // The server's refusal is under test, not the browser's own checks.
    container.querySelector("form")?.setAttribute("novalidate", "");
    const title = () => screen.getByRole("group", { name: "Titre" });

    await user.type(within(title()).getByLabelText("Français"), "Démo");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await regionWith(screen, "alert", "Vérifiez les champs signalés.");

    expect(within(title()).getByLabelText("Français")).toHaveValue("Démo");
    expect(within(title()).getByText("À traduire")).toBeInTheDocument();
  });

  it("says why dates were refused on the end date, and goes there", async () => {
    const user = userEvent.setup();
    const save =
      vi.fn<
        (state: ContentFormState, data: FormData) => Promise<ContentFormState>
      >();
    save.mockResolvedValue({
      status: "invalid",
      problems: { endedOn: { problem: "invalid" } },
    });
    render(
      <ProjectForm
        action={save}
        project={PROJECT}
        skills={SKILLS}
        media={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await regionWith(screen, "alert", "Vérifiez les champs signalés.");

    const end = screen.getByLabelText("Fin");
    expect(end).toHaveFocus();
    expect(end).toHaveAccessibleDescription(
      /La fin ne peut ni précéder le début, ni venir sans lui\./,
    );
    expect(save.mock.calls[0]?.[1].getAll("skills")).toEqual(["rust"]);
  });
});

describe("ExperienceList", () => {
  it("dates each position, the current one up to today, with no order to set", () => {
    render(
      <ExperienceList
        experiences={[
          {
            id: "e-1",
            slug: "acme",
            status: "published",
            company: "Acme",
            role: "Développeur",
            startedOn: "2024-01-01",
            endedOn: null,
            english: "partial",
          },
          {
            id: "e-2",
            slug: "initech",
            status: "draft",
            company: "Initech",
            role: "",
            startedOn: "2021-09-01",
            endedOn: "2023-06-30",
            english: "complete",
          },
        ]}
      />,
    );

    const [acme, initech] = screen.getAllByRole("listitem");
    expect(acme).toHaveTextContent("janvier 2024 – aujourd'hui · acme");
    expect(acme).toHaveTextContent("Anglais incomplet");
    expect(initech).toHaveTextContent("septembre 2021 – juin 2023");
    expect(
      screen.getByRole("link", { name: "Modifier Développeur, Acme" }),
    ).toHaveAttribute("href", "/admin/experiences/e-1");
    expect(
      screen.getByRole("link", { name: "Modifier Initech" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Monter/ })).toBeNull();
  });
});

describe("ExperienceForm", () => {
  it("asks for a start, and leaves the end blank for a current position", () => {
    render(<ExperienceForm action={vi.fn()} skills={SKILLS} media={[]} />);

    expect(screen.getByLabelText("Début")).toBeRequired();
    expect(screen.getByLabelText("Fin")).not.toBeRequired();
    expect(screen.getByLabelText("Fin")).toHaveAccessibleDescription(
      "Vide tant que le poste est le vôtre.",
    );
    expect(
      within(screen.getByLabelText("Type de contrat"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "Temps plein",
      "Temps partiel",
      "Stage",
      "Alternance",
      "Freelance",
    ]);
    expect(
      within(
        screen.getByRole("group", { name: "Intitulé du poste" }),
      ).getByLabelText("Français"),
    ).toBeRequired();
  });
});
