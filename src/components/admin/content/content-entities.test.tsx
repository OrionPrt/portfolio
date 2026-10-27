import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/catalog/skills-admin-actions", () => ({
  createSkillAction: vi.fn(),
  updateSkillAction: vi.fn(),
  moveSkillAction: vi.fn(),
  deleteSkillAction: vi.fn(),
}));
vi.mock("@/features/profile/social-links-admin-actions", () => ({
  createSocialLinkAction: vi.fn(),
  updateSocialLinkAction: vi.fn(),
  moveSocialLinkAction: vi.fn(),
  deleteSocialLinkAction: vi.fn(),
}));
vi.mock("@/features/profile/admin-actions", () => ({
  saveProfileAction: vi.fn(),
}));

import { BackLink } from "./back-link";
import { ProfileForm } from "./profile-form";
import { SkillForm } from "./skill-form";
import { SkillList } from "./skill-list";
import { SocialLinksEditor } from "./social-links-editor";

const SKILL = {
  slug: "rust",
  name: "Rust",
  domain: "low_level",
  featured: true,
  sortOrder: 0,
  projectCount: 2,
  experienceCount: 1,
} as const;

describe("SkillList", () => {
  it("shows the skills by domain, each with what links it, an empty domain said so", () => {
    render(
      <SkillList
        skills={[
          { ...SKILL, id: "s-1" },
          {
            ...SKILL,
            id: "s-2",
            slug: "c",
            name: "C",
            featured: false,
            projectCount: 0,
            experienceCount: 0,
          },
        ]}
      />,
    );

    const lowLevel = screen.getByRole("region", { name: "Bas niveau" });
    const [rust, c] = within(lowLevel).getAllByRole("listitem");
    expect(rust).toHaveTextContent("En avant");
    expect(rust).toHaveTextContent("Liée à 2 projets et 1 expérience");
    expect(c).toHaveTextContent("Liée à rien");
    expect(
      within(rust ?? document.body).getByRole("button", {
        name: "Monter Rust",
      }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      within(rust ?? document.body).getByRole("link", {
        name: "Modifier Rust",
      }),
    ).toHaveAttribute("href", "/admin/skills/s-1");
    expect(
      within(screen.getByRole("region", { name: "Web" })).getByText(
        "Aucune compétence dans ce domaine.",
      ),
    ).toBeInTheDocument();
  });
});

describe("SocialLinksEditor", () => {
  const LINK = {
    id: "l-1",
    kind: "github",
    url: "https://github.com/orion",
    sortOrder: 0,
    visible: false,
  } as const;

  it("gives each link its form, and offers only the kinds left to add", () => {
    render(<SocialLinksEditor links={[LINK]} />);

    const card = screen.getByRole("listitem");
    expect(
      within(card).getByRole("heading", { name: /GitHub/ }),
    ).toHaveTextContent("Masqué");
    expect(within(card).getByLabelText("Adresse")).toHaveValue(
      "https://github.com/orion",
    );
    const kinds = within(
      screen.getByRole("region", { name: "Ajouter un lien" }),
    ).getAllByRole("option");
    expect(kinds.map((option) => option.textContent)).not.toContain("GitHub");
    expect(kinds).toHaveLength(6);
  });
});

describe("ProfileForm", () => {
  it("starts from the saved profile, French and English side by side", () => {
    render(
      <ProfileForm
        profile={{
          displayName: "Orion",
          location: null,
          translations: {
            fr: {
              headline: "Ingénieur",
              availability: "Disponible",
              pitch: "Je construis.",
              aboutMd: "",
              lookingFor: null,
            },
          },
        }}
      />,
    );

    expect(screen.getByLabelText("Nom affiché")).toHaveValue("Orion");
    const headline = screen.getByRole("group", { name: "Titre" });
    expect(within(headline).getByLabelText("Français")).toHaveValue(
      "Ingénieur",
    );
    expect(within(headline).getByLabelText(/^Anglais/)).toHaveValue("");
    expect(within(headline).getByText("À traduire")).toBeInTheDocument();
  });
});

describe("SkillForm", () => {
  it("starts empty for a new skill, and from the skill with its id to edit one", () => {
    const save = vi.fn();
    const { container, rerender } = render(<SkillForm action={save} />);
    expect(screen.getByLabelText("Nom")).toHaveValue("");
    expect(screen.getByLabelText("Domaine")).toHaveValue("web");
    expect(container.querySelector("input[name=id]")).toBeNull();

    rerender(
      <SkillForm key="s-1" action={save} skill={{ ...SKILL, id: "s-1" }} />,
    );
    expect(screen.getByLabelText("Nom")).toHaveValue("Rust");
    expect(screen.getByLabelText(/^Slug/)).toHaveAccessibleDescription(
      /lettres minuscules/,
    );
    expect(screen.getByLabelText("Mise en avant")).toBeChecked();
    expect(container.querySelector("input[name=id]")).toHaveValue("s-1");
  });
});

describe("BackLink", () => {
  it("goes up to the list, its arrow left out of the name", () => {
    render(<BackLink href="/admin/skills" label="Retour aux compétences" />);

    expect(
      screen.getByRole("link", { name: "Retour aux compétences" }),
    ).toHaveAttribute("href", "/admin/skills");
  });
});
