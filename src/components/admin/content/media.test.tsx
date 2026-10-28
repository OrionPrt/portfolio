import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { regionWith } from "../../../../test/dom";
import { MediaLibrary, MediaUsages } from "./media-library";
import { MediaUploadForm } from "./media-upload-form";

const THUMBNAIL = {
  width: 480,
  height: 270,
  url: "/api/media/media/m-1/480.webp",
  bytes: 1,
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function answer(status: number, body: unknown) {
  fetchMock.mockResolvedValue(Response.json(body, { status }));
}

async function chooseAndSend(user: ReturnType<typeof userEvent.setup>) {
  // jsdom reads a file input as empty whatever user-event puts in it, and
  // would block the submission: the browser's check is the E2E suite's to see.
  document.querySelector("form")?.setAttribute("novalidate", "");
  await user.upload(
    screen.getByLabelText("Image"),
    new File(["png"], "capture.png", { type: "image/png" }),
  );
  const alt = screen.getByRole("group", { name: "Texte alternatif" });
  await user.type(within(alt).getByLabelText("Français"), "Capture");
  await user.type(within(alt).getByLabelText("Anglais"), "Screenshot");
  await user.click(screen.getByRole("button", { name: "Ajouter" }));
}

describe("MediaLibrary", () => {
  it("shows each image by its French text, with what shows it", () => {
    render(
      <MediaLibrary
        images={[
          {
            id: "m-1",
            alt: "Capture du tableau de bord",
            width: 1600,
            height: 900,
            thumbnail: THUMBNAIL,
            usageCount: 2,
          },
          {
            id: "m-2",
            alt: "Logo",
            width: 400,
            height: 400,
            thumbnail: THUMBNAIL,
            usageCount: 0,
          },
        ]}
      />,
    );

    const [dashboard, logo] = screen.getAllByRole("listitem");
    expect(dashboard).toHaveTextContent("Capture du tableau de bord");
    expect(dashboard).toHaveTextContent("1600 × 900 px");
    expect(dashboard).toHaveTextContent("Affichée par 2 entrées");
    expect(logo).toHaveTextContent("Affichée nulle part");
    expect(
      screen.getByRole("link", { name: "Modifier Capture du tableau de bord" }),
    ).toHaveAttribute("href", "/admin/media/m-1");
  });

  it("says when it is empty", () => {
    render(<MediaLibrary images={[]} />);

    expect(screen.getByText("La médiathèque est vide.")).toBeInTheDocument();
  });
});

describe("MediaUsages", () => {
  it("links each entry showing the image to its page, its kind named", () => {
    render(
      <MediaUsages
        usages={[
          { kind: "project", id: "p-1", label: "Démo" },
          { kind: "certification", id: "c-1", label: "OSCP" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Projet Démo" })).toHaveAttribute(
      "href",
      "/admin/projects/p-1",
    );
    expect(
      screen.getByRole("link", { name: "Certification OSCP" }),
    ).toHaveAttribute("href", "/admin/certifications/c-1");
  });

  it("says when nothing shows it", () => {
    render(<MediaUsages usages={[]} />);

    expect(screen.getByText("Aucune entrée ne l'affiche.")).toBeInTheDocument();
  });
});

describe("MediaUploadForm", () => {
  it("sends the file and both texts, then shows the library again", async () => {
    const user = userEvent.setup();
    answer(201, { status: "saved", id: "m-1" });
    render(<MediaUploadForm />);

    await chooseAndSend(user);
    await regionWith(screen, "status", "Image ajoutée à la médiathèque.");

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/admin/media");
    const sent = init?.body as FormData;
    expect(sent.get("alt.fr")).toBe("Capture");
    expect(sent.get("alt.en")).toBe("Screenshot");
    expect(sent.get("file")).toBeInstanceOf(File);
    expect(router.refresh).toHaveBeenCalled();
  });

  it("says why a file was refused, on the file field", async () => {
    const user = userEvent.setup();
    answer(400, {
      status: "invalid",
      problems: { file: { problem: "taken" } },
    });
    render(<MediaUploadForm />);

    await chooseAndSend(user);
    await regionWith(screen, "alert", "Vérifiez les champs signalés.");

    const file = screen.getByLabelText("Image");
    expect(file).toHaveAccessibleDescription(
      /Cette image est déjà dans la médiathèque\./,
    );
    expect(file).toHaveFocus();
    // The texts typed stay; only the file must be chosen again.
    expect(
      within(
        screen.getByRole("group", { name: "Texte alternatif" }),
      ).getByLabelText("Français"),
    ).toHaveValue("Capture");
  });

  it("sends a signed-out admin to the login, and reads a failure as such", async () => {
    const user = userEvent.setup();
    answer(401, { status: "signed_out" });
    render(<MediaUploadForm />);

    await chooseAndSend(user);
    await regionWith(screen, "alert", /indisponible/);
    expect(router.push).toHaveBeenCalledWith("/admin/login");
  });
});
