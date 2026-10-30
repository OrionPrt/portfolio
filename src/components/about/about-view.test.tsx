import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { profileView } from "../../../test/fixtures/views";
import { renderWithIntl } from "../../../test/render";
import { AboutView } from "./about-view";

// An async server component: the plain renderer stands in for it under jsdom.
vi.mock(
  "@/components/content/rich-markdown",
  () => import("../../../test/mocks/rich-markdown"),
);

describe("AboutView", () => {
  it("presents the owner, the facts given and where to find them", () => {
    renderWithIntl(
      <AboutView
        profile={profileView({
          aboutMd: "Parcours **atypique**.",
          location: "Lyon",
          socialLinks: [{ kind: "github", url: "https://github.com/OrionPrt" }],
        })}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Orion",
    );
    expect(screen.getByText("Mon accroche.")).toBeVisible();
    expect(screen.getByText("atypique")).toBeVisible();
    expect(screen.getByText("Localisation")).toBeVisible();
    expect(screen.queryByText("Ce que je recherche")).toBeNull();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });

  it("leaves out the links section when there is none", () => {
    renderWithIntl(<AboutView profile={profileView()} />);

    expect(screen.queryByRole("heading", { name: "Me retrouver" })).toBeNull();
  });
});
