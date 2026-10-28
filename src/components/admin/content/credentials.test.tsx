import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ContentFormState } from "@/features/admin/content-form-state";
import type { CertificationForEdit } from "@/features/catalog/certifications-admin-repository";
import type { EducationForEdit } from "@/features/catalog/education-admin-repository";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/catalog/education-admin-actions", () => ({
  createEducationAction: vi.fn(),
  updateEducationAction: vi.fn(),
  deleteEducationAction: vi.fn(),
}));
vi.mock("@/features/catalog/certifications-admin-actions", () => ({
  createCertificationAction: vi.fn(),
  updateCertificationAction: vi.fn(),
  deleteCertificationAction: vi.fn(),
}));

import { regionWith } from "../../../../test/dom";
import { CertificationForm } from "./certification-form";
import { CertificationList } from "./certification-list";
import { EducationForm } from "./education-form";
import { EducationList } from "./education-list";

const INSA: EducationForEdit = {
  id: "e-1",
  school: "INSA Lyon",
  location: "Villeurbanne",
  logoMediaId: null,
  startedOn: "2018-09-01",
  endedOn: null,
  sortOrder: 0,
  translations: {
    fr: { degree: "Diplôme d'ingénieur", description: "Informatique" },
  },
};

const OSCP: CertificationForEdit = {
  id: "c-1",
  name: "OSCP",
  issuer: "OffSec",
  issuedOn: "2024-03-01",
  expiresOn: null,
  credentialId: "OS-1",
  verifyUrl: "https://credentials.offsec.com/1",
  badgeMediaId: null,
  sortOrder: 0,
  translations: { fr: { description: "" } },
};

describe("EducationList", () => {
  it("names each entry by its degree and school, dated, with what its English lacks", () => {
    render(
      <EducationList
        entries={[
          {
            id: "e-1",
            school: "INSA Lyon",
            degree: "Diplôme d'ingénieur",
            startedOn: "2018-09-01",
            endedOn: null,
            english: "missing",
          },
        ]}
      />,
    );

    const entry = screen.getByRole("listitem");
    expect(entry).toHaveTextContent("septembre 2018 – aujourd'hui");
    expect(entry).toHaveTextContent("Anglais à traduire");
    expect(
      within(entry).getByRole("link", {
        name: "Modifier Diplôme d'ingénieur, INSA Lyon",
      }),
    ).toHaveAttribute("href", "/admin/education/e-1");
    expect(within(entry).queryByRole("button", { name: /^Monter/ })).toBeNull();
  });
});

describe("CertificationList", () => {
  it("says who issued each certification, when, until when, and which have expired", () => {
    render(
      <CertificationList
        certifications={[
          {
            id: "c-1",
            name: "OSCP",
            issuer: "OffSec",
            issuedOn: "2024-03-01",
            expiresOn: "2027-03-01",
            isExpired: false,
            english: "partial",
          },
          {
            id: "c-2",
            name: "CEH",
            issuer: "EC-Council",
            issuedOn: "2019-05-01",
            expiresOn: "2022-05-01",
            isExpired: true,
            english: "complete",
          },
        ]}
      />,
    );

    const [oscp, ceh] = screen.getAllByRole("listitem");
    expect(oscp).toHaveTextContent(
      "OffSec · obtenue en mars 2024 · expire en mars 2027",
    );
    expect(oscp).toHaveTextContent("Anglais incomplet");
    expect(oscp).not.toHaveTextContent("Expirée");
    expect(ceh).toHaveTextContent("CEH (2019) Expirée");
    expect(ceh).toHaveTextContent("a expiré en mai 2022");
    expect(
      screen.getByRole("link", { name: "Modifier OSCP (2024)" }),
    ).toHaveAttribute("href", "/admin/certifications/c-1");
  });

  it("tells a renewed certification from the first by its year", () => {
    const entry = {
      issuer: "OffSec",
      expiresOn: null,
      isExpired: false,
      english: "complete",
    } as const;
    render(
      <CertificationList
        certifications={[
          { ...entry, id: "c-2", name: "OSCP", issuedOn: "2025-03-01" },
          { ...entry, id: "c-1", name: "OSCP", issuedOn: "2022-03-01" },
        ]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Supprimer OSCP (2025)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Supprimer OSCP (2022)" }),
    ).toBeInTheDocument();
  });

  it("says when there is none yet", () => {
    render(<CertificationList certifications={[]} />);

    expect(
      screen.getByText("Aucune certification pour l'instant."),
    ).toBeInTheDocument();
  });
});

describe("EducationForm", () => {
  it("asks for a school, a start and a French degree, never a slug", () => {
    render(<EducationForm action={vi.fn()} media={[]} />);

    expect(screen.getByLabelText("Établissement")).toBeRequired();
    expect(screen.getByLabelText("Début")).toBeRequired();
    expect(screen.getByLabelText("Fin")).toHaveAccessibleDescription(
      "Vide tant que la formation est en cours.",
    );
    expect(
      within(screen.getByRole("group", { name: "Diplôme" })).getByLabelText(
        "Français",
      ),
    ).toBeRequired();
    expect(screen.queryByLabelText(/Slug/)).toBeNull();
    // No draft: saving publishes, and the button says so.
    expect(
      screen.getByRole("button", { name: "Enregistrer" }),
    ).toHaveAccessibleDescription(
      "Enregistrée, l'entrée est aussitôt visible sur le site.",
    );
  });

  it("starts from the entry to edit", () => {
    const { container } = render(
      <EducationForm action={vi.fn()} entry={INSA} media={[]} />,
    );

    expect(screen.getByLabelText("Lieu")).toHaveValue("Villeurbanne");
    expect(
      within(screen.getByRole("group", { name: "Description" })).getByLabelText(
        "Français",
      ),
    ).toHaveValue("Informatique");
    expect(container.querySelector("input[name=id]")).toHaveValue("e-1");
  });
});

describe("CertificationForm", () => {
  it("asks for a name, an issuer and a date; the rest, in both languages, may wait", () => {
    render(<CertificationForm action={vi.fn()} media={[]} />);

    expect(screen.getByLabelText("Nom")).toBeRequired();
    expect(screen.getByLabelText("Organisme")).toBeRequired();
    expect(screen.getByLabelText("Expire le")).toHaveAccessibleDescription(
      "Vide si elle n'expire pas.",
    );
    const description = screen.getByRole("group", { name: "Description" });
    for (const control of within(description).getAllByRole("textbox")) {
      expect(control).not.toBeRequired();
    }
    expect(
      within(screen.getByRole("group", { name: "La certification" })).getByRole(
        "group",
        { name: "Description" },
      ),
    ).toBe(description);
  });

  it("starts from the certification, its dates named as such", () => {
    const { container } = render(
      <CertificationForm action={vi.fn()} certification={OSCP} media={[]} />,
    );

    const issued = screen.getByLabelText("Obtenue le");
    expect(issued).toBeRequired();
    expect(issued).toHaveValue("2024-03-01");
    expect(issued).toHaveAttribute("name", "issuedOn");
    expect(screen.getByLabelText("Expire le")).toHaveAttribute(
      "name",
      "expiresOn",
    );
    expect(screen.getByLabelText("Lien de vérification")).toHaveValue(
      "https://credentials.offsec.com/1",
    );
    expect(container.querySelector("input[name=id]")).toHaveValue("c-1");
  });

  it("says why an expiry was refused, and goes there", async () => {
    const user = userEvent.setup();
    const save =
      vi.fn<
        (state: ContentFormState, data: FormData) => Promise<ContentFormState>
      >();
    save.mockResolvedValue({
      status: "invalid",
      problems: { expiresOn: { problem: "invalid" } },
    });
    render(<CertificationForm action={save} certification={OSCP} media={[]} />);

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await regionWith(screen, "alert", "Vérifiez les champs signalés.");

    const expiry = screen.getByLabelText("Expire le");
    expect(expiry).toHaveFocus();
    expect(expiry).toHaveAccessibleDescription(
      /L'expiration ne peut précéder l'obtention\./,
    );
  });
});
