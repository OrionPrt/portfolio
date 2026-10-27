import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ContentFormState,
  ListActionState,
} from "@/features/admin/content-form-state";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { ANNOUNCER_ID } from "../announce";
import { BilingualField } from "./bilingual-field";
import { CheckboxField, SelectField } from "./choice-fields";
import { ContentForm } from "./content-form";
import { DeleteEntry, MoveButtons } from "./list-actions";
import { TextField } from "./text-field";
import { regionWith } from "../../../../test/dom";

const save =
  vi.fn<
    (state: ContentFormState, data: FormData) => Promise<ContentFormState>
  >();
const listAction =
  vi.fn<(state: ListActionState, data: FormData) => Promise<ListActionState>>();

beforeAll(() => {
  // jsdom has <dialog> without its modal behavior.
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.open = true;
    },
    close(this: HTMLDialogElement) {
      this.open = false;
    },
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

interface SkillFormProps {
  readonly name?: string;
}

function SkillForm({ name = "Rust" }: SkillFormProps) {
  return (
    <ContentForm action={save} hidden={{ id: "skill-1" }}>
      <TextField name="name" label="Nom" initial={name} isRequired />
      <TextField
        name="slug"
        label="Slug"
        initial="rust"
        invalidMessage="Lettres minuscules, chiffres et tirets."
        takenMessage="Ce slug est déjà pris."
      />
      <SelectField
        name="domain"
        label="Domaine"
        initial="web"
        options={[
          ["web", "Web"],
          ["devops", "DevOps"],
        ]}
      />
      <CheckboxField name="featured" label="Mise en avant" initial />
      {/* Another page of the site, as the router would follow it. */}
      <a href={`${window.location.origin}/elsewhere`}>Ailleurs</a>
      <a href="#name">Aller au nom</a>
    </ContentForm>
  );
}

describe("ContentForm", () => {
  it("sends the fields only, never the last outcome, and announces the save", async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({ status: "saved" });
    render(<SkillForm />);

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    const [previous, sent] = save.mock.calls[0] ?? [];
    expect(previous).toEqual({ status: "idle" });
    expect(sent?.get("id")).toBe("skill-1");
    expect(sent?.get("name")).toBe("Rust");
    await regionWith(screen, "status", "Modifications enregistrées.");
  });

  it("keeps what was sent after a refusal, an unticked box and a chosen option included", async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({
      status: "invalid",
      problems: { slug: { problem: "invalid" } },
    });
    render(<SkillForm />);

    await user.clear(screen.getByLabelText("Slug"));
    await user.type(screen.getByLabelText("Slug"), "Not A Slug");
    await user.click(screen.getByLabelText("Mise en avant"));
    await user.selectOptions(screen.getByLabelText("Domaine"), "devops");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await regionWith(screen, "alert", "Vérifiez les champs signalés.");
    const slug = screen.getByLabelText("Slug");
    await waitFor(() => {
      expect(slug).toHaveFocus();
    });
    expect(slug).toHaveValue("Not A Slug");
    expect(slug).toHaveAccessibleDescription(
      "Lettres minuscules, chiffres et tirets.",
    );
    expect(screen.getByLabelText("Mise en avant")).not.toBeChecked();
    expect(screen.getByLabelText("Domaine")).toHaveValue("devops");
  });

  it("starts from the stored values once saved", async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({ status: "saved" });
    const { rerender } = render(<SkillForm />);

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText("Modifications enregistrées.");
    // The page refreshed: new stored values.
    rerender(<SkillForm name="Rust (lang)" />);

    expect(screen.getByLabelText("Nom")).toHaveValue("Rust (lang)");
  });

  it("puts a taken value on its field", async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({
      status: "invalid",
      problems: { slug: { problem: "taken" } },
    });
    render(<SkillForm />);

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Slug")).toHaveAccessibleDescription(
        "Ce slug est déjà pris.",
      );
    });
  });

  it.each([
    [{ status: "not_found" }, "Cette entrée n'existe plus."],
    [{ status: "full" }, "Le nombre maximal d'entrées est atteint"],
    [{ status: "unavailable" }, "Service momentanément indisponible"],
  ] as const)("words %j", async (state, text) => {
    const user = userEvent.setup();
    save.mockResolvedValue(state);
    render(<SkillForm />);

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await regionWith(screen, "alert", text);
  });

  it("stops saying it is saved once something is typed again", async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({ status: "saved" });
    render(<SkillForm />);

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText("Modifications enregistrées.");
    await user.type(screen.getByLabelText("Nom"), "x");

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("asks before leaving with unsaved changes, once however many forms, and no longer once saved", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    save.mockResolvedValue({ status: "saved" });
    render(
      <>
        <SkillForm />
        <SkillForm />
      </>,
    );
    const [link] = screen.getAllByRole("link", { name: "Ailleurs" });
    let followed = false;
    link?.addEventListener("click", (event) => {
      followed = !event.defaultPrevented;
      event.preventDefault();
    });
    const [firstName, secondName] = screen.getAllByLabelText("Nom");

    await user.type(firstName ?? document.body, "x");
    await user.type(secondName ?? document.body, "y");
    // A fragment of this page (the skip link) does not leave it.
    const [skip] = screen.getAllByRole("link", { name: "Aller au nom" });
    await user.click(skip ?? document.body);
    expect(confirm).not.toHaveBeenCalled();
    await user.click(link ?? document.body);
    expect(confirm).toHaveBeenCalledOnce();
    expect(followed).toBe(false);

    for (const button of screen.getAllByRole("button", {
      name: "Enregistrer",
    })) {
      await user.click(button);
    }
    await screen.findAllByText("Modifications enregistrées.");
    await user.click(link ?? document.body);
    expect(confirm).toHaveBeenCalledOnce();
    expect(followed).toBe(true);
  });

  it("names its button after the entry when several forms share a page", () => {
    render(
      <ContentForm action={save} context="GitHub">
        <TextField name="url" label="Adresse" initial="" />
      </ContentForm>,
    );

    expect(
      screen.getByRole("button", { name: "Enregistrer GitHub" }),
    ).toBeInTheDocument();
  });
});

describe("BilingualField", () => {
  it("offers each language in its own, and flags the translation still to write", async () => {
    const user = userEvent.setup();
    render(
      <ContentForm action={save}>
        <BilingualField
          name="headline"
          label="Accroche"
          initial={{ fr: "", en: "" }}
          isRequired
        />
      </ContentForm>,
    );

    const group = screen.getByRole("group", { name: "Accroche" });
    const french = within(group).getByLabelText("Français");
    expect(french).toHaveAttribute("lang", "fr");
    expect(french).toHaveAttribute("name", "fr.headline");
    expect(french).toBeRequired();
    expect(within(group).getByLabelText("Anglais")).not.toBeRequired();

    await user.type(french, "Ingénieur");
    const english = within(group).getByLabelText("Anglais À traduire");
    expect(english).toHaveAttribute("name", "en.headline");
    await user.type(english, "Engineer");
    expect(within(group).queryByText("À traduire")).toBeNull();
  });

  it("previews Markdown with the site's renderer, and still sends the text", async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({ status: "saved" });
    render(
      <ContentForm action={save}>
        <BilingualField
          name="aboutMd"
          label="À propos"
          kind="markdown"
          initial={{ fr: "## Parcours\n\nDu **web** au bas niveau.", en: "" }}
        />
      </ContentForm>,
    );

    const [preview, englishPreview] = screen.getAllByRole("button", {
      name: /^Aperçu/,
    });
    expect(preview).toHaveAccessibleName("Aperçu français");
    await user.click(preview ?? document.body);

    expect(
      await screen.findByRole("heading", { level: 2, name: "Parcours" }),
    ).toBeInTheDocument();
    expect(preview).toHaveAttribute("aria-pressed", "true");
    await user.click(englishPreview ?? document.body);
    expect(
      screen.getByText("Rien à afficher pour l'instant."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(save.mock.calls[0]?.[1].get("fr.aboutMd")).toContain("Parcours");
  });
});

describe("list actions", () => {
  it("move an entry once per click, ends and pending moves inert but focusable", async () => {
    const user = userEvent.setup();
    let settle: (state: ListActionState) => void = () => undefined;
    listAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    render(
      <MoveButtons
        action={listAction}
        id="s-1"
        label="Rust"
        isFirst
        isLast={false}
      />,
    );

    const up = screen.getByRole("button", { name: "Monter Rust" });
    expect(up).toHaveAttribute("aria-disabled", "true");
    await user.click(up);
    expect(listAction).not.toHaveBeenCalled();

    const down = screen.getByRole("button", { name: "Descendre Rust" });
    await user.click(down);
    await user.click(down);
    expect(listAction).toHaveBeenCalledOnce();
    expect(listAction.mock.calls[0]?.[1].get("direction")).toBe("down");
    await act(() => {
      settle({ status: "done" });
      return Promise.resolve();
    });
    await regionWith(screen, "status", "Ordre enregistré.");
  });

  it("delete only after a confirmation that names the entry and what goes with it", async () => {
    const user = userEvent.setup();
    listAction.mockResolvedValue({ status: "not_found" });
    render(
      <DeleteEntry
        action={listAction}
        id="s-1"
        label="Rust"
        title="Supprimer la compétence « Rust » ?"
        consequence="Ses liens avec 2 projets disparaissent aussi."
      />,
    );

    await user.click(screen.getByRole("button", { name: "Supprimer Rust" }));
    const dialog = screen.getByRole("dialog", {
      name: "Supprimer la compétence « Rust » ?",
    });
    expect(dialog).toHaveAccessibleDescription(
      /^Ses liens avec 2 projets disparaissent aussi\. La suppression est définitive\./,
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Supprimer définitivement" }),
    );

    expect(listAction.mock.calls[0]?.[1].get("id")).toBe("s-1");
    await regionWith(within(dialog), "alert", "Cette entrée n'existe plus.");
  });

  it("once deleted, say so through the frame, and go back to the list if asked", async () => {
    const user = userEvent.setup();
    listAction.mockResolvedValue({ status: "done" });
    render(
      <>
        <p id={ANNOUNCER_ID} role="status" />
        <DeleteEntry
          action={listAction}
          id="s-1"
          label="Rust"
          title="Supprimer ?"
          afterDelete="/admin/skills"
        />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Supprimer Rust" }));
    await user.click(
      screen.getByRole("button", { name: "Supprimer définitivement" }),
    );

    expect(router.push).toHaveBeenCalledWith("/admin/skills");
    await vi.waitFor(() => {
      expect(document.getElementById(ANNOUNCER_ID)).toHaveTextContent(
        "Rust : supprimé.",
      );
    });
  });
});
