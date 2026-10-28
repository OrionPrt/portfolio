import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ContentForm } from "./content-form";
import { MediaField } from "./media-field";

const OPTIONS = [
  {
    id: "m-1",
    alt: "Capture du tableau de bord",
    alts: { fr: "Capture du tableau de bord", en: "Dashboard screenshot" },
    thumbnail: { width: 480, height: 270, url: "/m/1.webp", bytes: 1 },
  },
  {
    id: "m-2",
    alt: "Logo",
    alts: { fr: "Logo", en: "Logo" },
    thumbnail: { width: 480, height: 480, url: "/m/2.webp", bytes: 1 },
  },
];

function Field({ initial }: { readonly initial: string | null }) {
  return (
    <ContentForm action={vi.fn()}>
      <MediaField
        name="coverMediaId"
        label="Couverture"
        initial={initial}
        options={OPTIONS}
      />
    </ContentForm>
  );
}

describe("MediaField", () => {
  it("offers the library by its texts, none first, and shows the one chosen", async () => {
    const user = userEvent.setup();
    const { container } = render(<Field initial="m-1" />);
    const select = screen.getByLabelText("Couverture");

    expect(select).toHaveValue("m-1");
    expect(select).toHaveAccessibleDescription(/médiathèque/);
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Aucune", "Capture du tableau de bord", "Logo"]);
    expect(container.querySelector("img")).toHaveAttribute("src", "/m/1.webp");

    await user.selectOptions(select, "m-2");
    expect(container.querySelector("img")).toHaveAttribute("src", "/m/2.webp");
    await user.selectOptions(select, "");
    expect(container.querySelector("img")).toBeNull();
  });

  it("follows a stored value that changes, select and glimpse together", () => {
    const { container, rerender } = render(<Field initial="m-1" />);

    rerender(<Field initial="m-2" />);

    expect(screen.getByLabelText("Couverture")).toHaveValue("m-2");
    expect(container.querySelector("img")).toHaveAttribute("src", "/m/2.webp");
  });

  it("starts from none", () => {
    render(<Field initial={null} />);

    expect(screen.getByLabelText("Couverture")).toHaveValue("");
  });
});
