import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContactFormState } from "@/features/contact/form-state";
import type { SocialLinkView } from "@/features/profile/repository";

import { renderWithIntl } from "../../../test/render";
import { ContactView } from "./contact-view";

const LINKS: readonly SocialLinkView[] = [
  { kind: "github", url: "https://github.com/me" },
  { kind: "email", url: "mailto:me@example.com" },
  { kind: "linkedin", url: "https://www.linkedin.com/in/me/" },
];

const action = () => Promise.resolve<ContactFormState>({ status: "sent" });

describe("ContactView", () => {
  beforeEach(() => {
    window.turnstile = {
      render: vi.fn(() => "widget"),
      reset: vi.fn(),
      remove: vi.fn(),
    };
  });

  afterEach(() => {
    delete window.turnstile;
  });

  it("offers the form, and email and LinkedIn as direct ways", () => {
    renderWithIntl(
      <ContactView
        form={{ siteKey: "site-key", nonce: undefined }}
        action={action}
        links={LINKS}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Me contacter" }),
    ).toBeVisible();
    expect(
      screen.getByRole("form", { name: "Écrire un message" }),
    ).toBeInTheDocument();
    const direct = screen.getByRole("region", {
      name: "Me joindre directement",
    });
    expect(
      within(direct)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["me@example.com", "mailto:me@example.com"],
      ["linkedin.com/in/me", "https://www.linkedin.com/in/me/"],
    ]);
    expect(
      within(direct).getByRole("link", { name: "linkedin.com/in/me" }),
    ).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("says the form is unavailable while it is not configured", () => {
    renderWithIntl(
      <ContactView form={undefined} action={action} links={LINKS} />,
    );

    expect(screen.queryByRole("form")).toBeNull();
    expect(
      screen.getByText(/Le formulaire n'est pas disponible pour le moment/),
    ).toBeVisible();
  });

  it("leaves out the direct ways when none is published", () => {
    renderWithIntl(
      <ContactView
        form={{ siteKey: "site-key", nonce: undefined }}
        action={action}
        links={[]}
      />,
    );

    expect(
      screen.queryByRole("region", { name: "Me joindre directement" }),
    ).toBeNull();
  });
});
