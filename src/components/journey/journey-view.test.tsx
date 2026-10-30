import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  CertificationView,
  EducationView,
} from "@/features/catalog/repository";
import type { PlatformView } from "@/features/platforms/repository";

import { COVER } from "../../../test/fixtures/views";
import { renderWithIntl } from "../../../test/render";
import { JourneyView } from "./journey-view";

const EPITECH: EducationView = {
  slug: "epitech",
  school: "Epitech",
  location: "Paris",
  startedOn: "2021-09-01",
  endedOn: null,
  degree: "Expert en technologies de l'information",
  description: "Cinq ans de projets.",
  logo: COVER,
  isFallback: false,
  contentLocale: "fr",
};

const OSCP: CertificationView = {
  slug: "oscp",
  name: "OSCP",
  issuer: "OffSec",
  issuedOn: "2025-03-01",
  expiresOn: null,
  isExpired: false,
  credentialId: "OS-101",
  verifyUrl: "https://verify.example/oscp",
  description: "",
  badge: undefined,
  isFallback: false,
  contentLocale: "fr",
};

const HTB: PlatformView = {
  name: "Hack The Box",
  profileUrl: "https://app.hackthebox.com/profile/1",
  rank: "Pro Hacker",
  points: 12_500,
  updatedOn: "2026-10-30",
};

function section(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

describe("JourneyView", () => {
  it("lists the education, the certifications and the platforms, each in its section", () => {
    renderWithIntl(
      <JourneyView
        education={[EPITECH]}
        certifications={[OSCP]}
        platforms={[HTB]}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Parcours",
    );
    expect(
      within(section("Formation")).getByRole("listitem"),
    ).toHaveTextContent(
      "Expert en technologies de l'information Epitech · Paris · septembre 2021 — aujourd'hui Cinq ans de projets.",
    );
    const certification = within(section("Certifications")).getByRole(
      "listitem",
    );
    expect(certification).toHaveTextContent(
      "OSCP OffSec · Obtenue en mars 2025 Identifiant : OS-101 Vérifier",
    );
    expect(
      within(certification).getByRole("link", {
        name: "Vérifier la certification OSCP",
      }),
    ).toHaveAttribute("rel", "noopener noreferrer");
    const platform = within(section("Plateformes")).getByRole("listitem");
    expect(platform).toHaveTextContent(
      "Hack The Box Pro Hacker · relevé le 30 octobre 2026 12 500 points",
    );
    expect(
      within(platform).getByRole("link", { name: "Hack The Box" }),
    ).toHaveAttribute("href", HTB.profileUrl);
  });

  it("says when a certification expires, and marks one that has", () => {
    renderWithIntl(
      <JourneyView
        education={[]}
        certifications={[
          { ...OSCP, expiresOn: "2999-03-01" },
          {
            ...OSCP,
            slug: "old",
            name: "Old",
            expiresOn: "2024-01-01",
            isExpired: true,
          },
        ]}
        platforms={[]}
      />,
    );

    const [valid, expired] = within(section("Certifications")).getAllByRole(
      "listitem",
    );
    expect(valid).toHaveTextContent("expire en mars 2999");
    expect(
      within(expired ?? document.body).getByText(/expirée depuis/),
    ).toHaveClass("text-warning");
    expect(expired).toHaveTextContent("expirée depuis janvier 2024");
  });

  it("leaves out an empty section, and says so when all are", () => {
    const { rerender } = renderWithIntl(
      <JourneyView education={[]} certifications={[OSCP]} platforms={[]} />,
    );

    expect(screen.queryByRole("region", { name: "Formation" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Plateformes" })).toBeNull();

    rerender(<JourneyView education={[]} certifications={[]} platforms={[]} />);

    expect(screen.getByText("Rien à montrer pour l'instant.")).toBeVisible();
  });

  it("marks a degree shown in another language", () => {
    renderWithIntl(
      <JourneyView
        education={[{ ...EPITECH, isFallback: true, contentLocale: "en" }]}
        certifications={[]}
        platforms={[]}
      />,
    );

    expect(
      within(section("Formation")).getByRole("heading", { level: 3 }),
    ).toHaveAttribute("lang", "en");
  });

  it("marks a certification's description shown in another language", () => {
    renderWithIntl(
      <JourneyView
        education={[]}
        certifications={[
          {
            ...OSCP,
            description: "Offensive security.",
            isFallback: true,
            contentLocale: "en",
          },
        ]}
        platforms={[]}
      />,
    );

    expect(screen.getByText("Offensive security.")).toHaveAttribute(
      "lang",
      "en",
    );
  });

  it("keeps no room for images in a section that has none", () => {
    const { container } = renderWithIntl(
      <JourneyView education={[]} certifications={[OSCP]} platforms={[]} />,
    );

    expect(container.querySelector("li > span[aria-hidden]")).toBeNull();
  });

  it("calls nothing empty when a read failed: the page says so already", () => {
    renderWithIntl(
      <JourneyView
        education={[]}
        certifications={[]}
        platforms={[]}
        isUnavailable
      />,
    );

    expect(screen.queryByText("Rien à montrer pour l'instant.")).toBeNull();
  });
});
