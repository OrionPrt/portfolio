import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EducationView, TileView } from "@/features/catalog/repository";
import type { TileKind } from "@/features/content/vocabulary";

import {
  COVER,
  experienceView,
  postSummary,
  profileView,
  projectView,
} from "../../../test/fixtures/views";
import { renderWithIntl } from "../../../test/render";
import { BentoHub, FALLBACK_TILES, type HubData } from "./bento-hub";

const ALL_TILES: readonly TileView[] = (
  [
    "identity",
    "featured_project",
    "current_experience",
    "stack",
    "cyber_stats",
    "latest_post",
    "certifications",
    "cv",
    "contact",
  ] as const satisfies readonly TileKind[]
).map((kind) => ({ kind, size: "sm" }));

const SKILLS = [
  { slug: "ts", name: "TypeScript", domain: "web", featured: true },
  { slug: "react", name: "React", domain: "web", featured: false },
  { slug: "vue", name: "Vue", domain: "web", featured: false },
  { slug: "css", name: "CSS", domain: "web", featured: false },
  { slug: "c", name: "C", domain: "low_level", featured: true },
] as const;

const EPITECH: EducationView = {
  slug: "epitech",
  school: "Epitech",
  location: "Paris",
  startedOn: "2021-09-01",
  endedOn: null,
  degree: "Expert en technologies de l'information",
  description: "",
  logo: undefined,
  isFallback: false,
  contentLocale: "fr",
};

function hub(overrides: Partial<HubData> = {}): HubData {
  return {
    tiles: ALL_TILES,
    profile: profileView({
      socialLinks: [
        { kind: "email", url: "mailto:me@example.com" },
        { kind: "linkedin", url: "https://linkedin.com/in/me" },
        { kind: "hackthebox", url: "https://app.hackthebox.com/profile/1" },
      ],
    }),
    featuredProject: projectView({
      skills: ["a", "b", "c", "d", "e"].map((slug) => ({
        slug,
        name: slug.toUpperCase(),
      })),
    }),
    currentExperience: experienceView(),
    skills: SKILLS,
    education: [EPITECH],
    latestPost: postSummary(),
    certifications: [
      {
        slug: "oscp",
        name: "OSCP",
        issuer: "OffSec",
        issuedOn: "2025-01-01",
        expiresOn: null,
        credentialId: null,
        verifyUrl: null,
        description: "",
        badge: undefined,
      },
    ],
    ...overrides,
  };
}

function tileTitles(): string[] {
  return screen
    .getAllByRole("region")
    .map((tile) => tile.getAttribute("aria-labelledby") ?? "");
}

describe("BentoHub", () => {
  it("renders the configured tiles in order, skipping those not built yet", () => {
    renderWithIntl(<BentoHub data={hub()} />);

    expect(tileTitles()).toEqual([
      "identity-title-fr",
      "featured-portfolio-title-fr",
      "experience-acme-title-fr",
      "stack-title-fr",
      "platforms-title-fr",
      "latest-post-a-box-title-fr",
      "journey-title-fr",
      "contact-title-fr",
    ]);
  });

  it("hides every tile that has nothing to show", () => {
    renderWithIntl(
      <BentoHub
        data={hub({
          profile: profileView(),
          featuredProject: undefined,
          currentExperience: undefined,
          skills: [],
          education: [],
          certifications: [],
          latestPost: undefined,
        })}
      />,
    );

    // The contact form is always there, even with no link to show.
    expect(tileTitles()).toEqual(["identity-title-fr", "contact-title-fr"]);
  });

  it("keeps the identity tile, which holds the h1, even when left out", () => {
    renderWithIntl(
      <BentoHub data={hub({ tiles: [{ kind: "contact", size: "sm" }] })} />,
    );

    expect(tileTitles()).toEqual(["identity-title-fr", "contact-title-fr"]);
  });

  it("introduces the owner, with a way to reach them", () => {
    renderWithIntl(<BentoHub data={hub()} />);
    const identity = screen.getByRole("region", { name: "Orion" });

    expect(within(identity).getByText("Disponible")).toBeVisible();
    expect(
      within(identity).getByRole("link", { name: "À propos" }),
    ).toHaveAttribute("href", "/fr/a-propos");
    expect(
      within(identity).getByRole("link", { name: "Me contacter" }),
    ).toHaveAttribute("href", "mailto:me@example.com");
  });

  it("still names the site when no profile could be read", () => {
    renderWithIntl(
      <BentoHub data={hub({ profile: undefined, tiles: FALLBACK_TILES })} />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Orion",
    );
    expect(
      screen.getByText(
        "Ingénieur logiciel — fullstack, DevOps et cybersécurité.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: "Me contacter" })).toBeNull();
  });

  it("opens the featured project and the current position from their tiles", () => {
    renderWithIntl(<BentoHub data={hub()} />);

    expect(screen.getByRole("link", { name: "Ce portfolio" })).toHaveAttribute(
      "href",
      "/fr/projets/portfolio",
    );
    expect(screen.getByRole("link", { name: "Développeur" })).toHaveAttribute(
      "href",
      "/fr/experiences/acme",
    );
    expect(screen.getByText(/Acme · depuis septembre 2024/)).toBeVisible();
    // Four technologies at most on the tile.
    expect(screen.queryByText("E")).toBeNull();
  });

  it("sums up the skills by domain, featured ones first", () => {
    renderWithIntl(<BentoHub data={hub()} />);
    const stack = screen.getByRole("region", { name: "compétences" });

    expect(within(stack).getByText(/TypeScript, React, Vue/)).toBeVisible();
    expect(within(stack).getByText("+1")).toBeVisible();
    expect(within(stack).getByText("bas niveau")).toBeVisible();
  });

  it("splits the links between the platforms and contact tiles", () => {
    renderWithIntl(<BentoHub data={hub()} />);

    const platforms = screen.getByRole("region", { name: "plateformes" });
    const contact = screen.getByRole("region", { name: "contact" });

    expect(
      within(platforms)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Hack The Box"]);
    expect(
      within(contact)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Écrire un message", "E-mail", "LinkedIn"]);
    expect(
      within(contact).getByRole("link", { name: "LinkedIn" }),
    ).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("opens the contact page from the contact tile", () => {
    renderWithIntl(<BentoHub data={hub()} />);

    expect(
      within(screen.getByRole("region", { name: "contact" })).getByRole(
        "link",
        { name: "Écrire un message" },
      ),
    ).toHaveAttribute("href", "/fr/contact");
  });

  it("sums up the journey: the latest education, then the certifications, each image beside its name", () => {
    const data = hub();
    const [oscp] = data.certifications;
    renderWithIntl(
      <BentoHub
        data={{
          ...data,
          education: [{ ...EPITECH, logo: COVER }],
          certifications: oscp === undefined ? [] : [{ ...oscp, badge: COVER }],
        }}
      />,
    );

    const tile = screen.getByRole("region", { name: "parcours" });
    const [school, certification] = within(tile).getAllByRole("listitem");
    expect(school).toHaveTextContent(
      "formation Expert en technologies de l'information Epitech · 2021 — aujourd'hui",
    );
    expect(certification).toHaveTextContent("certification OSCP OffSec");
    for (const image of tile.querySelectorAll("img")) {
      expect(image).toHaveAttribute("alt", "");
    }
  });

  it("keeps room for two certifications beside an education, and marks a degree shown in another language", () => {
    const data = hub();
    const [oscp] = data.certifications;
    const certifications =
      oscp === undefined
        ? []
        : ["a", "b", "c"].map((slug) => ({ ...oscp, slug, name: slug }));
    renderWithIntl(
      <BentoHub
        data={{
          ...data,
          education: [{ ...EPITECH, isFallback: true, contentLocale: "en" }],
          certifications,
        }}
      />,
    );

    const tile = screen.getByRole("region", { name: "parcours" });
    expect(within(tile).getAllByRole("listitem")).toHaveLength(3);
    expect(within(tile).getByText(EPITECH.degree)).toHaveAttribute(
      "lang",
      "en",
    );
  });

  it("shows the journey with an education alone", () => {
    renderWithIntl(<BentoHub data={hub({ certifications: [] })} />);

    expect(
      within(screen.getByRole("region", { name: "parcours" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(1);
  });
});
