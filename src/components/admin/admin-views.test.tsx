import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AuditEntry } from "@/features/auth/audit-repository";

vi.mock("@/features/auth/actions", () => ({ signOutAction: vi.fn() }));

import { AdminShell } from "./admin-shell";
import { AuditList } from "./audit-list";
import { AuthCard } from "./auth-card";

const FIREFOX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0";
const AT = new Date("2026-10-25T12:00:00Z");

function entry(id: number, overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id,
    actorId: "user-1",
    action: "auth.login_succeeded",
    entity: null,
    entityId: null,
    diff: null,
    ipHash: null,
    userAgent: null,
    createdAt: AT,
    ...overrides,
  };
}

describe("AdminShell", () => {
  it("names the page, marks it in the navigation, and offers to sign out", () => {
    render(
      <AdminShell title="Sécurité" current="security">
        <p>Contenu</p>
      </AdminShell>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Sécurité",
    );
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(within(nav).getByRole("link", { name: "Sécurité" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(nav).getByRole("link", { name: "Tableau de bord" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      within(nav).getByRole("button", { name: "Se déconnecter" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Aller au contenu" }),
    ).toHaveAttribute("href", "#admin-main");
    // The brand reads as words, not as "orion ~/admin".
    expect(screen.getByText("Orion, administration")).toHaveClass("sr-only");
    expect(screen.getByText("~/admin").closest("[aria-hidden]")).not.toBeNull();
  });
});

describe("AuthCard", () => {
  it("holds the login step's only h1", () => {
    render(
      <AuthCard title="Connexion" lead="Espace réservé.">
        <p>Formulaire</p>
      </AuthCard>,
    );

    expect(screen.getByRole("region", { name: "Connexion" })).toHaveTextContent(
      "Espace réservé.",
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("AuditList", () => {
  it("lists the events in words, with their details, device and network hash", () => {
    render(
      <AuditList
        entries={[
          entry(2, {
            action: "auth.login_failed",
            diff: { step: "totp", nested: { x: 1 } },
            userAgent: FIREFOX,
            ipHash: "abcdef0123456789".repeat(4),
          }),
          entry(1, { action: "auth.unknown_event" }),
        ]}
      />,
    );

    const [failed, unknown] = screen.getAllByRole("listitem");
    expect(failed).toHaveTextContent("Échec de connexion");
    expect(failed).toHaveTextContent(/étape\s:\scode TOTP/);
    expect(failed).not.toHaveTextContent("nested");
    expect(failed).toHaveTextContent("Firefox · Linux · réseau abcdef01");
    expect(unknown).toHaveTextContent("auth.unknown_event");
  });

  it("says when nothing was recorded", () => {
    render(<AuditList entries={[]} />);

    expect(screen.getByText("Aucun événement enregistré.")).toBeVisible();
  });
});
