import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AuditEntry } from "@/features/auth/audit-repository";

const navigation = vi.hoisted(() => ({ pathname: "/admin" }));

vi.mock("@/features/auth/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

import { AdminSidebar } from "./admin-sidebar";
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

describe("AdminSidebar", () => {
  it("marks the current section, and offers to sign out", () => {
    navigation.pathname = "/admin/security";
    render(<AdminSidebar unread={0} />);

    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(within(nav).getByRole("link", { name: "Sécurité" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(nav).getByRole("link", { name: "Tableau de bord" }),
    ).not.toHaveAttribute("aria-current");
    expect(within(nav).getByRole("link", { name: "Messages" })).toHaveAttribute(
      "href",
      "/admin/messages",
    );
    expect(
      within(nav).getByRole("list", { name: "Vue d'ensemble" }),
    ).toBeInTheDocument();
    // Signing out is not navigation: it sits below the links, in the banner.
    expect(
      within(screen.getByRole("banner")).getByRole("button", {
        name: "Se déconnecter",
      }),
    ).toBeInTheDocument();
    // The brand reads as words, not as "orion ~/admin".
    expect(screen.getByText("Orion, administration")).toHaveClass("sr-only");
    expect(screen.getByText("~/admin").closest("[aria-hidden]")).not.toBeNull();
  });

  it.each([
    [3, "/admin/messages", "Messages 3 non lus", "page"],
    [
      1,
      `/admin/messages/${"0".repeat(8)}-0000-4000-8000-${"0".repeat(12)}`,
      "Messages 1 non lu",
      "true",
    ],
    [undefined, "/admin", "Messages", null],
  ] as const)(
    "names the messages link with %s unread on %s",
    (unread, pathname, name, current) => {
      navigation.pathname = pathname;
      render(<AdminSidebar unread={unread} />);

      const link = screen.getByRole("link", { name });
      if (current === null) {
        expect(link).not.toHaveAttribute("aria-current");
      } else {
        expect(link).toHaveAttribute("aria-current", current);
      }
    },
  );
});

describe("AuthCard", () => {
  it("holds the login step's only h1", () => {
    render(
      <AuthCard titleId="t" title="Connexion" lead="Espace réservé.">
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

  it("names what a content event changed", () => {
    render(
      <AuditList
        entries={[
          entry(3, {
            action: "content.updated",
            entity: "bento_tile",
            entityId: "layout",
          }),
          entry(4, { action: "contact.message_deleted", entity: "message" }),
        ]}
      />,
    );
    const [updated, deleted] = screen.getAllByRole("listitem");

    expect(updated).toHaveTextContent("Contenu modifié · grille d'accueil");
    expect(deleted).toHaveTextContent("Message supprimé");
    expect(deleted).not.toHaveTextContent("·");
  });

  it("says when nothing was recorded", () => {
    render(<AuditList entries={[]} />);

    expect(screen.getByText("Aucun événement enregistré.")).toBeVisible();
  });
});
