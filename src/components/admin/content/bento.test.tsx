import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentFormState } from "@/features/admin/content-form-state";
import type { TileSetting } from "@/features/bento/layout";

import { ANNOUNCER_ID } from "../announce";

const NB = "\u00a0";

const save = vi.hoisted(() =>
  vi.fn<
    (state: ContentFormState, data: FormData) => Promise<ContentFormState>
  >(),
);

vi.mock("@/features/bento/admin-actions", () => ({
  saveBentoLayoutAction: save,
}));

import { BentoForm } from "./bento-editor";

const LAYOUT: readonly TileSetting[] = [
  { kind: "identity", size: "xl", visible: true },
  { kind: "featured_project", size: "xl", visible: true },
  { kind: "current_experience", size: "sm", visible: true },
  { kind: "stack", size: "md", visible: true },
  { kind: "cyber_stats", size: "sm", visible: true },
  { kind: "certifications", size: "sm", visible: true },
  { kind: "contact", size: "sm", visible: true },
];

function Editor({
  emptyKinds = [],
  layout = LAYOUT,
}: {
  readonly emptyKinds?: TileSetting["kind"][];
  readonly layout?: readonly TileSetting[];
}) {
  return (
    <>
      <BentoForm layout={layout} emptyKinds={emptyKinds} />
      {/* The admin frame's announcer. */}
      <p id={ANNOUNCER_ID} />
    </>
  );
}

function rows(): string[] {
  const group = screen.getByRole("group", { name: "Les tuiles" });
  return within(within(group).getByRole("list"))
    .getAllByRole("listitem")
    .map((item) => item.querySelector("span")?.textContent ?? "");
}

/** The preview's row count, under its drawing. */
function rowsStatus(): HTMLElement {
  return within(
    screen.getByRole("figure", { name: "Aperçu sur grand écran" }),
  ).getByText(/rangées? (sur|:)/);
}

/** The admin frame's announcer says it. */
function announced(text: string): Promise<void> {
  return waitFor(() => {
    expect(document.getElementById(ANNOUNCER_ID)).toHaveTextContent(text);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BentoForm", () => {
  it("lists the tiles in order, with the sizes each one fits", () => {
    render(<Editor />);

    expect(rows()).toEqual([
      "Identité",
      "Projet phare",
      "Expérience en cours",
      "Compétences",
      "Plateformes cyber",
      "Parcours",
      "Contact",
    ]);
    const contactSize = screen.getByRole("combobox", {
      name: "Taille (Contact)",
    });
    expect(contactSize).toHaveValue("sm");
    expect(
      within(contactSize)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([`Petite, 1${NB}×${NB}1`, `Large, 2${NB}×${NB}1`]);
    // The identity holds the page's h1: no box to hide it.
    expect(
      screen.queryByRole("checkbox", { name: "Affichée (Identité)" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/elle porte le titre de la page/)).toBeVisible();
    expect(rowsStatus()).toHaveTextContent(
      // toHaveTextContent folds the text's no-break spaces, not the expected ones.
      "4 rangées sur 4 : l'accueil tient sur un écran, si le texte des tuiles y tient aussi.",
    );
  });

  it("moves a tile, keeping the focus on the button and saying where it went", async () => {
    const user = userEvent.setup();
    render(<Editor />);

    const down = screen.getByRole("button", {
      name: "Descendre la tuile Projet phare",
    });
    await user.click(down);

    expect(rows().slice(0, 3)).toEqual([
      "Identité",
      "Expérience en cours",
      "Projet phare",
    ]);
    expect(down).toHaveFocus();
    await announced("Tuile Projet phare déplacée en position 3 sur 7.");
  });

  it("keeps a row's size when it moves", async () => {
    const user = userEvent.setup();
    render(<Editor />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Taille (Contact)" }),
      "md",
    );
    await user.click(
      screen.getByRole("button", { name: "Monter la tuile Contact" }),
    );

    expect(rows().at(-2)).toBe("Contact");
    expect(
      screen.getByRole("combobox", { name: "Taille (Contact)" }),
    ).toHaveValue("md");
  });

  it("starts again from the layout saved, once the page refreshes", async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({ status: "saved" });
    const { rerender } = render(<Editor />);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Taille (Contact)" }),
      "md",
    );
    await user.click(screen.getByRole("button", { name: /Enregistrer/ }));
    await waitFor(() => {
      expect(save).toHaveBeenCalled();
    });

    // The refreshed page brings the stored layout, whenever it arrives.
    rerender(
      <Editor
        layout={LAYOUT.map((tile) =>
          tile.kind === "contact" ? { ...tile, size: "md" } : tile,
        )}
      />,
    );

    expect(
      screen.getByRole("combobox", { name: "Taille (Contact)" }),
    ).toHaveValue("md");
    expect(
      screen.getByRole("figure", { name: "Aperçu sur grand écran" }),
    ).toHaveTextContent("Contact");
  });

  it("keeps the buttons at the ends inert", async () => {
    const user = userEvent.setup();
    render(<Editor />);

    const up = screen.getByRole("button", { name: "Monter la tuile Identité" });
    expect(up).toHaveAttribute("aria-disabled", "true");
    await user.click(up);

    expect(rows()[0]).toBe("Identité");
  });

  it("warns, before saving, when the hub no longer fits one screen", async () => {
    const user = userEvent.setup();
    render(<Editor />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Taille (Compétences)" }),
      "xl",
    );
    // Dense packing still fits it in four rows.
    expect(rowsStatus()).toHaveTextContent("4 rangées sur 4");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Taille (Parcours)" }),
      "md",
    );

    expect(rowsStatus()).toHaveTextContent(
      "5 rangées : l'accueil dépasse un écran de 1280 × 720 (4 rangées) et défile.",
    );
    // The new height is said once, by the frame's announcer.
    await announced("5 rangées : l'accueil dépasse un écran");

    await user.click(
      screen.getByRole("checkbox", { name: "Affichée (Compétences)" }),
    );
    expect(rowsStatus()).toHaveTextContent("4 rangées sur 4");
  });

  it("says which tiles show nothing, and leaves them out of the preview", () => {
    render(<Editor emptyKinds={["certifications", "current_experience"]} />);

    expect(
      screen.getByRole("checkbox", { name: "Affichée (Parcours)" }),
    ).toHaveAccessibleDescription(
      `Aucune formation ni certification${NB}: la tuile n'apparaît pas sur le site.`,
    );
    const preview = screen.getByRole("figure", {
      name: "Aperçu sur grand écran",
    });
    expect(preview).not.toHaveTextContent("Parcours");
    expect(preview).toHaveTextContent("Contact");
  });

  it("sends the whole layout, in order, with every size and box", async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({ status: "saved" });
    render(<Editor />);

    await user.click(
      screen.getByRole("button", { name: "Monter la tuile Contact" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Affichée (Plateformes cyber)" }),
    );
    await user.click(screen.getByRole("button", { name: /Enregistrer/ }));

    const sent = save.mock.calls[0]?.[1];
    expect(sent?.getAll("order")).toEqual([
      "identity",
      "featured_project",
      "current_experience",
      "stack",
      "cyber_stats",
      "contact",
      "certifications",
    ]);
    expect(sent?.get("size.contact")).toBe("sm");
    expect(sent?.get("visible.identity")).toBe("on");
    expect(sent?.get("visible.cyber_stats")).toBeNull();
    expect(sent?.get("visible.contact")).toBe("on");
  });

  it("shows again what was sent when the save is refused", async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({ status: "unavailable" });
    render(<Editor />);

    await user.click(
      screen.getByRole("button", { name: "Descendre la tuile Identité" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Taille (Contact)" }),
      "md",
    );
    await user.click(screen.getByRole("button", { name: /Enregistrer/ }));

    // The alert region is there from the start, empty: wait for its words.
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "réessayez plus tard",
      );
    });
    expect(rows().slice(0, 2)).toEqual(["Projet phare", "Identité"]);
    expect(
      screen.getByRole("combobox", { name: "Taille (Contact)" }),
    ).toHaveValue("md");
  });
});
