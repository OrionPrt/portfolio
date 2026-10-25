import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { experienceView } from "../../../test/fixtures/views";
import { renderWithIntl } from "../../../test/render";
import { ExperienceCard } from "./experience-card";
import { ExperienceDetail } from "./experience-detail";

/** The element whose whole text is `text`, even when split across <time> children. */
function period(text: string) {
  return screen.getByText(
    (_content, element) =>
      element?.tagName === "SPAN" && element.textContent === text,
  );
}

describe("ExperienceDetail", () => {
  it("shows the role, the company and an ongoing period", () => {
    renderWithIntl(
      <ExperienceDetail
        experience={experienceView({
          companyUrl: "https://acme.example",
          location: "Paris",
          skills: [{ slug: "rust", name: "Rust" }],
        })}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Développeur",
    );
    expect(screen.getByRole("link", { name: "Acme" })).toHaveAttribute(
      "href",
      "https://acme.example",
    );
    expect(screen.getByText("Poste actuel")).toBeVisible();
    expect(screen.getByText("Alternance")).toBeVisible();
    expect(screen.getByText("Paris")).toBeVisible();
    expect(period("septembre 2024 — aujourd'hui")).toBeVisible();
    expect(screen.getByRole("link", { name: "Rust" })).toBeVisible();
  });

  it("shows an ended position with both dates and a plain company name", () => {
    renderWithIntl(
      <ExperienceDetail
        experience={experienceView({ endedOn: "2025-06-30", isCurrent: false })}
      />,
      "en",
    );

    expect(screen.queryByRole("link", { name: "Acme" })).toBeNull();
    expect(period("September 2024 — June 2025")).toBeVisible();
    expect(screen.queryByText("Current role")).toBeNull();
  });
});

describe("ExperienceCard", () => {
  it("links the position to its full view", () => {
    renderWithIntl(<ExperienceCard experience={experienceView()} />);

    expect(screen.getByRole("link", { name: "Développeur" })).toHaveAttribute(
      "href",
      "/fr/experiences/acme",
    );
    expect(screen.getByText("Acme · Alternance")).toBeVisible();
  });
});
