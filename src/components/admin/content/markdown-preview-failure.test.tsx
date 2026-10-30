import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// The preview's chunk cannot be fetched: a tab left open across a deploy.
vi.mock("./markdown-preview", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

import { BilingualField } from "./bilingual-field";
import { ContentForm } from "./content-form";

describe("a preview whose code cannot load", () => {
  it("says so, and keeps the form and its text", async () => {
    const user = userEvent.setup();
    render(
      <ContentForm action={vi.fn()}>
        <BilingualField
          name="technicalMd"
          label="Partie technique"
          kind="markdown"
          initial={{ fr: "Intro.", en: "" }}
          maxLength={50_000}
        />
      </ContentForm>,
    );

    await user.click(screen.getByRole("button", { name: "Aperçu français" }));

    expect(
      await screen.findByText(
        "Aperçu indisponible : rechargez la page, après avoir enregistré.",
      ),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Rédiger français" }));
    expect(screen.getByLabelText(/^Français/)).toHaveValue("Intro.");
  });
});
