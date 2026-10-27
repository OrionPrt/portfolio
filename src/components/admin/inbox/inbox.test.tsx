import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { InboxActionState } from "@/features/contact/inbox-state";

const actions = vi.hoisted(() => ({
  markMessageReadAction: vi.fn<(id: string) => Promise<void>>(),
  setMessageStatusAction:
    vi.fn<
      (state: InboxActionState, data: FormData) => Promise<InboxActionState>
    >(),
  deleteMessageAction:
    vi.fn<
      (state: InboxActionState, data: FormData) => Promise<InboxActionState>
    >(),
}));

vi.mock("@/features/contact/inbox-actions", () => actions);

import { InboxPagination } from "./inbox-pagination";
import { MessageActions } from "./message-actions";
import { MessageList } from "./message-list";
import { regionWith } from "../../../../test/dom";

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const AT = new Date("2026-10-25T12:00:00Z");

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
  actions.markMessageReadAction.mockResolvedValue(undefined);
});

describe("MessageList", () => {
  it("links each message, and says which are unread", () => {
    render(
      <MessageList
        messages={[
          {
            id: ID,
            name: "Ada",
            email: "ada@example.com",
            subject: "Une mission",
            status: "unread",
            createdAt: AT,
          },
          {
            id: "1f8fad5b-d9cb-469f-a165-70867728950e",
            name: "Alan",
            email: "alan@example.com",
            subject: "Bonjour",
            status: "read",
            createdAt: AT,
          },
        ]}
      />,
    );

    const [unread, read] = screen.getAllByRole("link");
    expect(unread).toHaveAccessibleName(
      /^Non lu, Une mission Ada · ada@example\.com \d/,
    );
    expect(unread).toHaveAttribute("href", `/admin/messages/${ID}`);
    expect(read).toHaveAccessibleName(/^Bonjour/);
    expect(read).toHaveTextContent("Alan · alan@example.com");
  });
});

describe("InboxPagination", () => {
  it("shows nothing when one page holds everything", () => {
    const { container } = render(
      <InboxPagination query={{ view: "received", page: 1 }} pages={1} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("links the newer and older pages of the same folder", () => {
    render(<InboxPagination query={{ view: "archived", page: 2 }} pages={3} />);

    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(
      within(nav).getByRole("link", { name: "Plus récents" }),
    ).toHaveAttribute("href", "/admin/messages?view=archived");
    expect(
      within(nav).getByRole("link", { name: "Plus anciens" }),
    ).toHaveAttribute("href", "/admin/messages?view=archived&page=3");
    expect(nav).toHaveTextContent("Page 2 sur 3");
  });
});

describe("MessageActions", () => {
  it("marks an unread message read once opened, and only then", () => {
    const { rerender } = render(<MessageActions id={ID} status="unread" />);
    rerender(<MessageActions id={ID} status="read" />);
    rerender(<MessageActions id={ID} status="unread" />);

    expect(actions.markMessageReadAction).toHaveBeenCalledOnce();
    expect(actions.markMessageReadAction).toHaveBeenCalledWith(ID);
  });

  it.each([
    ["read", ["Marquer comme non lu", "Archiver"]],
    ["archived", ["Remettre dans les reçus"]],
  ] as const)("offers what fits a %s message", (status, buttons) => {
    render(<MessageActions id={ID} status={status} />);

    expect(actions.markMessageReadAction).not.toHaveBeenCalled();
    for (const name of buttons) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("sends the change, and announces it", async () => {
    const user = userEvent.setup();
    actions.setMessageStatusAction.mockResolvedValue({
      status: "changed",
      to: "archived",
    });
    render(<MessageActions id={ID} status="read" />);

    await user.click(screen.getByRole("button", { name: "Archiver" }));

    const sent = actions.setMessageStatusAction.mock.calls[0]?.[1];
    expect(sent?.get("id")).toBe(ID);
    expect(sent?.get("status")).toBe("archived");
    await regionWith(screen, "status", "Message archivé.");
  });

  it("says when the message is gone", async () => {
    const user = userEvent.setup();
    actions.setMessageStatusAction.mockResolvedValue({ status: "not_found" });
    render(<MessageActions id={ID} status="read" />);

    await user.click(screen.getByRole("button", { name: "Archiver" }));

    await regionWith(screen, "alert", "Ce message n'existe plus.");
  });

  it("deletes only after an explicit confirmation, focus on Cancel first", async () => {
    const user = userEvent.setup();
    actions.deleteMessageAction.mockResolvedValue({ status: "unavailable" });
    render(<MessageActions id={ID} status="read" />);

    await user.click(screen.getByRole("button", { name: "Supprimer" }));
    const dialog = screen.getByRole("dialog", {
      name: "Supprimer ce message ?",
    });
    expect(dialog).toHaveAccessibleDescription(/effacé définitivement/);
    expect(
      within(dialog).getByRole("button", { name: "Annuler" }),
    ).toHaveFocus();

    await user.click(
      within(dialog).getByRole("button", { name: "Supprimer définitivement" }),
    );
    expect(actions.deleteMessageAction.mock.calls[0]?.[1]?.get("id")).toBe(ID);
    await regionWith(
      within(dialog),
      "alert",
      "Service momentanément indisponible",
    );

    await user.click(within(dialog).getByRole("button", { name: "Annuler" }));
    expect(dialog).not.toHaveAttribute("open");
  });

  it("starts each confirmation afresh: a cancelled error does not come back", async () => {
    const user = userEvent.setup();
    actions.deleteMessageAction.mockResolvedValue({ status: "not_found" });
    render(<MessageActions id={ID} status="read" />);
    await user.click(screen.getByRole("button", { name: "Supprimer" }));
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Supprimer définitivement" }),
    );
    await regionWith(within(dialog), "alert", "Ce message n'existe plus.");

    await user.click(within(dialog).getByRole("button", { name: "Annuler" }));
    await user.click(screen.getByRole("button", { name: "Supprimer" }));

    expect(within(dialog).getByRole("alert")).toBeEmptyDOMElement();
    expect(
      within(dialog).getByRole("button", { name: "Annuler" }),
    ).toHaveFocus();
  });

  it("says which change is under way, on the button pressed only", async () => {
    const user = userEvent.setup();
    actions.setMessageStatusAction.mockImplementation(
      () => new Promise(() => undefined),
    );
    render(<MessageActions id={ID} status="read" />);

    await user.click(screen.getByRole("button", { name: "Archiver" }));

    expect(
      await screen.findByRole("button", { name: "Enregistrement…" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Marquer comme non lu" }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});
