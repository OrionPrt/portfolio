import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ANNOUNCER_ID } from "../announce";
import { BilingualField } from "./bilingual-field";
import { ContentForm } from "./content-form";
import { MediaOptionsProvider } from "./media-options";

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

const OPTIONS = [
  {
    id: ID,
    alt: "Capture du tableau de bord",
    alts: { fr: "Capture du tableau de bord", en: "Dashboard screenshot" },
    thumbnail: {
      width: 480,
      height: 270,
      url: `/api/media/media/${ID}/480.webp`,
      bytes: 1,
    },
  },
];

function Editor({ options = OPTIONS }: { readonly options?: typeof OPTIONS }) {
  return (
    <MediaOptionsProvider options={options}>
      {/* The admin frame's announcer. */}
      <p id={ANNOUNCER_ID} role="status" />
      <ContentForm action={vi.fn()}>
        <BilingualField
          name="technicalMd"
          label="Partie technique"
          kind="markdown"
          initial={{ fr: "Intro.", en: "" }}
          maxLength={50_000}
        />
      </ContentForm>
    </MediaOptionsProvider>
  );
}

/** Each language's text area: its label may end with "À traduire". */
const LABELS = { Français: /^Français/, Anglais: /^Anglais/ } as const;

function textOf(locale: keyof typeof LABELS) {
  return within(
    screen.getByRole("group", { name: "Partie technique" }),
  ).getByLabelText<HTMLTextAreaElement>(LABELS[locale]);
}

describe("inserting an image in Markdown", () => {
  it("puts the chosen image where the caret is, with the field's language's text", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    const french = textOf("Français");
    french.setSelectionRange(6, 6);

    const open = screen.getByRole("button", {
      name: "Insérer une image français",
    });
    await user.click(open);
    expect(open).toHaveAttribute("aria-expanded", "true");
    await user.selectOptions(
      screen.getByLabelText("Image à insérer français"),
      ID,
    );
    await user.click(screen.getByRole("button", { name: "Insérer français" }));

    expect(french).toHaveValue(
      `Intro.\n\n![Capture du tableau de bord](media:${ID})\n`,
    );
    expect(french).toHaveFocus();
    expect(open).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => {
      expect(document.getElementById(ANNOUNCER_ID)).toHaveTextContent(
        "Image insérée dans le texte français.",
      );
    });
  });

  it("closes the panel on Escape, the focus back on its button", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    const open = screen.getByRole("button", {
      name: "Insérer une image français",
    });

    await user.click(open);
    await user.click(screen.getByLabelText("Image à insérer français"));
    await user.keyboard("{Escape}");

    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(open).toHaveFocus();
  });

  it("writes the English text in the English field, and counts the change as typed", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <>
        <Editor />
        <a href={`${window.location.origin}/elsewhere`}>Ailleurs</a>
      </>,
    );

    await user.click(
      screen.getByRole("button", { name: "Insérer une image anglais" }),
    );
    await user.click(screen.getByRole("button", { name: "Insérer anglais" }));

    expect(textOf("Anglais")).toHaveValue(
      `![Dashboard screenshot](media:${ID})\n`,
    );
    // The English is no longer "to translate": the field heard the text.
    expect(
      within(
        screen.getByRole("group", { name: "Partie technique" }),
      ).queryByText("À traduire"),
    ).toBeNull();
    const link = screen.getByRole("link", { name: "Ailleurs" });
    link.addEventListener("click", (event) => {
      event.preventDefault();
    });
    await user.click(link);
    expect(confirm).toHaveBeenCalledOnce();
    confirm.mockRestore();
  });

  it("previews the image, and offers nothing when the library is empty", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Editor />);
    const french = textOf("Français");
    french.setSelectionRange(6, 6);
    await user.click(
      screen.getByRole("button", { name: "Insérer une image français" }),
    );
    await user.click(screen.getByRole("button", { name: "Insérer français" }));

    await user.click(screen.getByRole("button", { name: "Aperçu français" }));

    expect(
      await screen.findByRole("img", { name: "Capture du tableau de bord" }),
    ).toBeVisible();
    unmount();

    render(<Editor options={[]} />);
    expect(
      screen.queryByRole("button", { name: /^Insérer une image/ }),
    ).toBeNull();
  });
});
