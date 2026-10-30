import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PlatformForEdit } from "@/features/platforms/admin-repository";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/platforms/admin-actions", () => ({
  createPlatformAction: vi.fn(),
  updatePlatformAction: vi.fn(),
  movePlatformAction: vi.fn(),
  deletePlatformAction: vi.fn(),
}));

import { PlatformsEditor } from "./platforms-editor";

const HTB: PlatformForEdit = {
  id: "0f8fad5b-d9cb-469f-a165-70867728950e",
  name: "Hack The Box",
  profileUrl: "https://app.hackthebox.com/profile/1",
  rank: "Pro Hacker",
  points: 12_500,
  updatedOn: "2026-10-30",
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PlatformsEditor", () => {
  it("gives each platform its form, under what it shows", () => {
    render(<PlatformsEditor platforms={[HTB]} />);

    const card = screen.getByRole("listitem");
    expect(
      within(card).getByRole("heading", { name: "Hack The Box" }),
    ).toBeVisible();
    // The summary as written, its spaces normalized by the matcher.
    expect(card).toHaveTextContent(
      "Pro Hacker · 12 500 points · relevé le 30 octobre 2026",
    );
    expect(within(card).getByLabelText("Points")).toHaveValue("12500");
    expect(within(card).getByLabelText("Points")).toHaveAttribute(
      "inputmode",
      "numeric",
    );
    expect(
      within(card).getByRole("button", { name: "Monter Hack The Box" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("says the list is empty, and offers an empty form to add one", () => {
    render(<PlatformsEditor platforms={[]} />);

    expect(screen.getByText("Aucune plateforme pour l'instant.")).toBeVisible();
    const add = screen.getByRole("region", { name: "Ajouter une plateforme" });
    expect(within(add).getByLabelText(/^Nom/)).toHaveValue("");
    expect(within(add).getByLabelText(/^Nom/)).toBeRequired();
  });
});
