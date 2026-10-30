import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type {
  ContentToDo,
  EntryRef,
} from "@/features/admin/dashboard-repository";
import { err, ok } from "@/lib/result";

import {
  ActivitySection,
  MediaPanel,
  PlatformsPanel,
  ToDoSection,
} from "./dashboard-sections";

const DOWN = err({ code: "DB_UNAVAILABLE", message: "down" });

const NOTHING: ContentToDo = {
  toTranslate: [],
  drafts: [],
  placeholders: [],
  withoutImage: [],
};

const PROJECT: EntryRef = {
  kind: "project",
  id: "0f8fad5b-d9cb-469f-a165-70867728950e",
  label: "Portfolio",
};

function group(name: string): HTMLElement {
  return screen.getByRole("group", {
    name: (accessibleName) => accessibleName.startsWith(name),
  });
}

describe("ToDoSection", () => {
  it("lists each kind of work left, linking every entry to its form", () => {
    render(
      <ToDoSection
        unread={2}
        content={ok({
          ...NOTHING,
          toTranslate: [
            { kind: "profile", id: "1", label: "Orion", english: "partial" },
            { ...PROJECT, english: "missing" },
          ],
          withoutImage: [PROJECT],
        })}
      />,
    );

    expect(screen.getByRole("group", { name: "Messages" })).toHaveTextContent(
      "2 messages non lus",
    );
    expect(
      screen.getByRole("link", { name: "Ouvrir la boîte de réception" }),
    ).toHaveAttribute("href", "/admin/messages");
    const toTranslate = group("À traduire");
    expect(
      within(toTranslate).getByRole("heading", { name: "À traduire (2)" }),
    ).toBeVisible();
    expect(
      within(toTranslate).getByRole("link", { name: "Orion" }),
    ).toHaveAttribute("href", "/admin/profile");
    const [profileItem, projectItem] =
      within(toTranslate).getAllByRole("listitem");
    expect(profileItem).toHaveTextContent("Profil");
    expect(profileItem).toHaveTextContent("anglais incomplet");
    expect(projectItem).toHaveTextContent("anglais absent");
    expect(
      within(group("Sans image")).getByRole("link", { name: "Portfolio" }),
    ).toHaveAttribute("href", `/admin/projects/${PROJECT.id}`);
    // A kind with nothing left shows no group.
    expect(
      screen.queryByRole("group", { name: /^Brouillons/ }),
    ).not.toBeInTheDocument();
    // Groups, not regions: the page keeps few landmarks.
    expect(screen.getAllByRole("region")).toHaveLength(1);
  });

  it("shows the first entries of a long group, the others behind a disclosure", async () => {
    const user = userEvent.setup();
    const drafts = Array.from({ length: 11 }, (_, index) => ({
      ...PROJECT,
      id: String(index),
      label: `Brouillon ${String(index)}`,
    }));
    render(<ToDoSection unread={0} content={ok({ ...NOTHING, drafts })} />);
    const others = within(group("Brouillons")).getByText("Et 3 autres");

    expect(
      within(group("Brouillons")).getByRole("link", { name: "Brouillon 7" }),
    ).toBeVisible();
    expect(screen.getByText("Brouillon 10")).not.toBeVisible();
    await user.click(others);
    expect(screen.getByRole("link", { name: "Brouillon 10" })).toBeVisible();
  });

  it("says when nothing is left", () => {
    render(<ToDoSection unread={0} content={ok(NOTHING)} />);

    expect(screen.getByRole("group", { name: "Messages" })).toHaveTextContent(
      "0 message non lu",
    );
    expect(
      // The query folds the page's no-break spaces, not its own.
      screen.getByText(
        "Rien en attente : tout est traduit, publié et complet.",
      ),
    ).toBeVisible();
  });

  it("says when the content could not be read, and still counts the messages", () => {
    render(<ToDoSection unread={1} content={DOWN} />);

    expect(screen.getByRole("group", { name: "Messages" })).toHaveTextContent(
      "1 message non lu",
    );
    expect(
      screen.getByText("Le contenu n'a pas pu être chargé."),
    ).toBeVisible();
  });
});

describe("ToDoSection's inbox", () => {
  it("says when the messages could not be counted", () => {
    render(<ToDoSection unread={undefined} content={ok(NOTHING)} />);

    expect(
      screen.getByText("Le nombre de messages non lus n'a pas pu être chargé."),
    ).toBeVisible();
  });
});

describe("MediaPanel", () => {
  it("counts the images against the ceiling, and those nothing shows", () => {
    render(<MediaPanel media={ok({ total: 12, unused: 3 })} />);
    const panel = screen.getByRole("region", { name: "Médiathèque" });

    expect(panel).toHaveTextContent(
      "12 images sur 200. 3 inutilisées : elles peuvent être supprimées.",
    );
    expect(
      within(panel).getByRole("link", { name: "Ouvrir la médiathèque" }),
    ).toHaveAttribute("href", "/admin/media");
  });

  it("says when the library is empty, or full", () => {
    const { rerender } = render(
      <MediaPanel media={ok({ total: 0, unused: 0 })} />,
    );
    expect(screen.getByText("Aucune image pour l'instant.")).toBeVisible();

    rerender(<MediaPanel media={ok({ total: 200, unused: 0 })} />);
    expect(screen.getByText(/La médiathèque est pleine/)).toBeVisible();
  });

  it("says when the library could not be read", () => {
    render(<MediaPanel media={DOWN} />);

    expect(
      screen.getByText("La médiathèque n'a pas pu être chargée."),
    ).toBeVisible();
  });
});

describe("PlatformsPanel", () => {
  const PLATFORM = { updatedOn: "2026-10-30" };

  it("counts the platforms, says when the oldest figures were read, and leads to them", () => {
    render(
      <PlatformsPanel
        platforms={ok([PLATFORM, { updatedOn: "2026-06-01" }])}
      />,
    );
    const panel = screen.getByRole("region", { name: "Plateformes" });

    expect(panel).toHaveTextContent(
      "2 plateformes, relevées au plus tôt le 1 juin 2026.",
    );
    expect(
      within(panel).getByRole("link", {
        name: "Mettre à jour les plateformes",
      }),
    ).toHaveAttribute("href", "/admin/platforms");
  });

  it("says what an empty list hides, and when it cannot be read", () => {
    const { rerender } = render(<PlatformsPanel platforms={ok([])} />);

    expect(
      screen.getByRole("region", { name: "Plateformes" }),
    ).toHaveTextContent(
      "Aucune plateforme : la tuile et la section du Parcours restent cachées.",
    );

    rerender(<PlatformsPanel platforms={DOWN} />);

    expect(
      screen.getByText("Les plateformes n'ont pas pu être chargées."),
    ).toBeVisible();
  });
});

describe("ActivitySection", () => {
  it("shows the latest events, and leads to the whole log", () => {
    render(
      <ActivitySection
        activity={ok([
          {
            id: 1,
            actorId: null,
            action: "content.updated",
            entity: "project",
            entityId: PROJECT.id,
            diff: null,
            ipHash: null,
            userAgent: null,
            createdAt: new Date("2026-10-29T10:00:00Z"),
          },
        ])}
      />,
    );

    expect(screen.getByRole("listitem")).toHaveTextContent(
      "Contenu modifié · projet",
    );
    expect(
      screen.getByRole("link", { name: "Tout le journal d'audit" }),
    ).toHaveAttribute("href", "/admin/security");
  });

  it("says when the log could not be read", () => {
    render(<ActivitySection activity={DOWN} />);

    expect(
      screen.getByText("Le journal d'audit n'a pas pu être chargé."),
    ).toBeVisible();
  });
});
