import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentFormState } from "@/features/admin/content-form-state";
import type { SkillOption } from "@/features/catalog/skill-options";

import { ANNOUNCER_ID } from "../announce";
import { ContentForm } from "./content-form";
import { SkillPicker } from "./skill-picker";

const save =
  vi.fn<
    (state: ContentFormState, data: FormData) => Promise<ContentFormState>
  >();

const SKILLS: readonly SkillOption[] = [
  { slug: "typescript", name: "TypeScript", domain: "web" },
  { slug: "react", name: "React", domain: "web" },
  { slug: "rust", name: "Rust", domain: "low_level" },
];

function Picker({ initial }: { readonly initial: readonly string[] }) {
  return (
    <>
      <ContentForm action={save}>
        <SkillPicker name="skills" skills={SKILLS} initial={initial} />
      </ContentForm>
      {/* The admin frame's announcer. */}
      <p id={ANNOUNCER_ID} role="status" />
    </>
  );
}

function picked(): string[] {
  const group = screen.getByRole("group", { name: "Compétences liées" });
  const list = within(group).queryByRole("list");
  return list === null
    ? []
    : within(list)
        .getAllByRole("listitem")
        .map((item) => item.firstChild?.textContent ?? "");
}

/** The admin frame's announcer says it: the form has a status region of its own. */
function announced(text: string): Promise<void> {
  return waitFor(() => {
    expect(document.getElementById(ANNOUNCER_ID)).toHaveTextContent(text);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SkillPicker", () => {
  it("adds skills from the catalog, in the order chosen, and sends them so", async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({ status: "saved" });
    render(<Picker initial={["react"]} />);

    expect(picked()).toEqual(["React"]);
    const chooser = screen.getByLabelText("Compétence à ajouter");
    expect(
      within(chooser)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["TypeScript", "Rust"]);
    await user.selectOptions(chooser, "rust");
    await user.click(screen.getByRole("button", { name: "Ajouter" }));
    await user.click(screen.getByRole("button", { name: "Monter Rust" }));
    expect(picked()).toEqual(["Rust", "React"]);

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(save.mock.calls[0]?.[1].getAll("skills")).toEqual(["rust", "react"]);
  });

  it("removes a skill, focus going back to the chooser, and keeps the ends inert", async () => {
    const user = userEvent.setup();
    render(<Picker initial={["typescript", "react"]} />);

    const up = screen.getByRole("button", { name: "Monter TypeScript" });
    expect(up).toHaveAttribute("aria-disabled", "true");
    await user.click(up);
    expect(picked()).toEqual(["TypeScript", "React"]);

    await user.click(
      screen.getByRole("button", { name: "Retirer TypeScript" }),
    );
    expect(picked()).toEqual(["React"]);
    expect(screen.getByLabelText("Compétence à ajouter")).toHaveFocus();
  });

  it("keeps the chosen order after a refusal", async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({ status: "invalid", problems: {} });
    render(<Picker initial={["typescript", "react"]} />);

    await user.click(screen.getByRole("button", { name: "Monter React" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText("Vérifiez les champs signalés.");

    expect(picked()).toEqual(["React", "TypeScript"]);
  });

  it("counts a change as unsaved", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <>
        <Picker initial={[]} />
        <a href={`${window.location.origin}/elsewhere`}>Ailleurs</a>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Ajouter" }));
    const link = screen.getByRole("link", { name: "Ailleurs" });
    link.addEventListener("click", (event) => {
      event.preventDefault();
    });
    await user.click(link);

    expect(confirm).toHaveBeenCalledOnce();
    confirm.mockRestore();
  });

  it("says when every skill is linked, and offers the chooser again once one is removed", async () => {
    const user = userEvent.setup();
    render(<Picker initial={["typescript", "react", "rust"]} />);

    expect(
      screen.getByText("Toutes les compétences sont déjà liées."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Compétence à ajouter")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Retirer Rust" }));
    expect(screen.getByLabelText("Compétence à ajouter")).toHaveFocus();
  });

  it("keeps the focus on a moved skill's button, and says where it went", async () => {
    const user = userEvent.setup();
    render(<Picker initial={["typescript", "react", "rust"]} />);

    const down = screen.getByRole("button", { name: "Descendre React" });
    await user.click(down);

    expect(picked()).toEqual(["TypeScript", "Rust", "React"]);
    expect(down).toHaveFocus();
    await announced("React déplacée en position 3 sur 3.");
  });

  it("moves the focus to the skill just added when no other is left", async () => {
    const user = userEvent.setup();
    render(<Picker initial={["typescript", "react"]} />);

    await user.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(screen.getByRole("button", { name: "Retirer Rust" })).toHaveFocus();
    await announced("Rust ajoutée, en position 3 sur 3.");
  });

  it("says a removal, and leaves the form clean while a skill is only chosen", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <>
        <Picker initial={["react"]} />
        <a href={`${window.location.origin}/elsewhere`}>Ailleurs</a>
      </>,
    );

    await user.selectOptions(
      screen.getByLabelText("Compétence à ajouter"),
      "rust",
    );
    const link = screen.getByRole("link", { name: "Ailleurs" });
    link.addEventListener("click", (event) => {
      event.preventDefault();
    });
    await user.click(link);
    expect(confirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Retirer React" }));
    await announced("React retirée.");
    confirm.mockRestore();
  });

  it("shows a refused list on the group, and focuses the chooser", async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({
      status: "invalid",
      problems: { skills: { problem: "too_long", max: 30 } },
    });
    render(<Picker initial={["react"]} />);

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText("Vérifiez les champs signalés.");

    expect(
      screen.getByRole("group", { name: "Compétences liées" }),
    ).toHaveAccessibleDescription(/30 compétences au plus, chacune une fois/);
    expect(screen.getByLabelText("Compétence à ajouter")).toHaveFocus();
  });
});
