import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CodeState,
  LoginState,
  PasswordState,
  RecoveryCodesState,
  SessionsState,
} from "@/features/auth/form-state";

const actions = vi.hoisted(() => ({
  signInAction:
    vi.fn<(state: LoginState, data: FormData) => Promise<LoginState>>(),
  secondFactorAction:
    vi.fn<(state: CodeState, data: FormData) => Promise<CodeState>>(),
  regenerateCodesAction:
    vi.fn<
      (state: RecoveryCodesState, data: FormData) => Promise<RecoveryCodesState>
    >(),
  changePasswordAction:
    vi.fn<(state: PasswordState, data: FormData) => Promise<PasswordState>>(),
  revokeSessionsAction:
    vi.fn<(state: SessionsState, data: FormData) => Promise<SessionsState>>(),
}));

vi.mock("@/features/auth/actions", () => actions);

import { LoginForm } from "./login-form";
import { PasswordForm } from "./password-form";
import { RecoveryCodesForm } from "./recovery-codes-form";
import { SecondFactorForm } from "./second-factor-form";
import { SessionsForm } from "./sessions-form";

const EMAIL = "admin@example.com";
const RECOVERY_CODE = "abcd-efgh-ijkl-mnop-qrst-uvwx";
const CODES = [RECOVERY_CODE, "yz23-4567-abcd-efgh-ijkl-mnop"];
/** The code fields' names end with what the code is for, for screen readers. */
const CODE_LABEL = /^Code à 6 chiffres/;
const REFUSED = "Code incorrect ou déjà utilisé.";

describe("admin forms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("LoginForm", () => {
    it("asks for the email and password, with the autofill hints", () => {
      render(<LoginForm />);

      expect(screen.getByLabelText("E-mail")).toHaveAttribute(
        "autocomplete",
        "username",
      );
      expect(screen.getByLabelText("Mot de passe")).toHaveAttribute(
        "autocomplete",
        "current-password",
      );
    });

    it.each([
      ["refused", "Identifiants incorrects."],
      ["locked", "Trop de tentatives"],
      ["unavailable", "Service momentanément indisponible"],
    ] as const)(
      "words a %s attempt, and refills the email it sent back",
      async (status, text) => {
        const user = userEvent.setup();
        // Another address than the one typed: the field shows the state's.
        actions.signInAction.mockResolvedValue({ status, email: "x@y.z" });
        render(<LoginForm />);

        await user.type(screen.getByLabelText("E-mail"), "a@b.c");
        await user.type(
          screen.getByLabelText("Mot de passe"),
          "secret password",
        );
        await user.click(screen.getByRole("button", { name: "Continuer" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(text);
        expect(screen.getByLabelText("E-mail")).toHaveValue("x@y.z");
        expect(screen.getByLabelText("Mot de passe")).toHaveValue("");
      },
    );
  });

  describe("SecondFactorForm", () => {
    it("asks for a 6-digit code, and switches to a recovery code", async () => {
      const user = userEvent.setup();
      render(<SecondFactorForm />);

      const code = screen.getByLabelText("Code à 6 chiffres");
      expect(code).toHaveAttribute("autocomplete", "one-time-code");
      expect(code).toHaveAttribute("inputmode", "numeric");
      expect(code).toHaveAccessibleDescription(
        /application d'authentification/,
      );
      expect(code).not.toHaveFocus();

      await user.click(
        screen.getByRole("button", {
          name: "Utiliser un code de récupération",
        }),
      );
      const recovery = screen.getByLabelText("Code de récupération");
      expect(recovery).toHaveFocus();
      expect(recovery).toHaveAccessibleDescription(/ne sert qu'une fois/);
      await user.click(
        screen.getByRole("button", {
          name: "Utiliser l'application d'authentification",
        }),
      );
      expect(screen.getByLabelText("Code à 6 chiffres")).toHaveFocus();
    });

    it("forgets a refusal when the method changes", async () => {
      const user = userEvent.setup();
      actions.secondFactorAction.mockResolvedValue({ status: "refused" });
      render(<SecondFactorForm />);

      await user.type(screen.getByLabelText("Code à 6 chiffres"), "000000");
      await user.click(screen.getByRole("button", { name: "Vérifier" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(REFUSED);
      await user.click(
        screen.getByRole("button", {
          name: "Utiliser un code de récupération",
        }),
      );

      expect(screen.queryByRole("alert")).toBeEmptyDOMElement();
    });

    it("sends the method with the code, and offers to start over once locked", async () => {
      const user = userEvent.setup();
      actions.secondFactorAction.mockResolvedValue({ status: "locked" });
      render(<SecondFactorForm />);

      await user.click(
        screen.getByRole("button", {
          name: "Utiliser un code de récupération",
        }),
      );
      await user.type(
        screen.getByLabelText("Code de récupération"),
        RECOVERY_CODE,
      );
      await user.click(screen.getByRole("button", { name: "Vérifier" }));

      const sent = actions.secondFactorAction.mock.calls[0]?.[1];
      expect(sent?.get("method")).toBe("recovery_code");
      expect(sent?.get("code")).toBe(RECOVERY_CODE);
      const alert = await screen.findByRole("alert");
      expect(
        within(alert).getByRole("link", { name: "Recommencer la connexion" }),
      ).toHaveAttribute("href", "/admin/login");
    });
  });

  describe("RecoveryCodesForm", () => {
    async function submit(code: string) {
      const user = userEvent.setup();
      await user.type(
        screen.getByLabelText("Votre mot de passe"),
        "current password",
      );
      await user.type(screen.getByLabelText(CODE_LABEL), code);
      await user.click(
        screen.getByRole("button", { name: "Générer de nouveaux codes" }),
      );
      return user;
    }

    it("tells how many codes are left, and shows new ones once", async () => {
      // user-event stands in for the clipboard.
      actions.regenerateCodesAction.mockResolvedValue({
        status: "issued",
        recoveryCodes: CODES,
      });
      render(<RecoveryCodesForm remaining={1} email={EMAIL} />);

      expect(
        screen.getByText("1 code de récupération disponible."),
      ).toBeVisible();
      const user = await submit("123456");
      const sent = actions.regenerateCodesAction.mock.calls[0]?.[1];
      expect(sent?.get("currentPassword")).toBe("current password");
      expect(sent?.get("username")).toBe(EMAIL);

      const title = await screen.findByRole("heading", {
        name: "Nouveaux codes de récupération",
        level: 3,
      });
      expect(title).toHaveFocus();
      expect(
        screen.getAllByRole("listitem").map((item) => item.textContent),
      ).toEqual(CODES);
      await user.click(
        screen.getByRole("button", { name: "Copier les codes" }),
      );
      expect(await navigator.clipboard.readText()).toBe(CODES.join("\n"));
      expect(await screen.findByRole("status")).toHaveTextContent(
        "Codes copiés",
      );
    });

    it("says when the codes cannot be copied", async () => {
      vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
        new Error("denied"),
      );
      actions.regenerateCodesAction.mockResolvedValue({
        status: "issued",
        recoveryCodes: CODES,
      });
      render(<RecoveryCodesForm remaining={1} email={EMAIL} />);

      const user = await submit("123456");
      await user.click(
        await screen.findByRole("button", { name: "Copier les codes" }),
      );

      expect(await screen.findByRole("status")).toHaveTextContent(
        "Copie impossible",
      );
    });

    it("words the count when none or several are left", () => {
      const { rerender } = render(
        <RecoveryCodesForm remaining={0} email={EMAIL} />,
      );
      expect(
        screen.getByText("Aucun code de récupération disponible."),
      ).toBeVisible();

      rerender(<RecoveryCodesForm remaining={3} email={EMAIL} />);
      expect(
        screen.getByText("3 codes de récupération disponibles."),
      ).toBeVisible();
    });

    it("says when the code is refused", async () => {
      actions.regenerateCodesAction.mockResolvedValue({ status: "refused" });
      render(<RecoveryCodesForm remaining={2} email={EMAIL} />);

      await submit("000000");

      expect(await screen.findByRole("alert")).toHaveTextContent(REFUSED);
    });
  });

  describe("PasswordForm", () => {
    async function submit(state: PasswordState) {
      const user = userEvent.setup();
      actions.changePasswordAction.mockResolvedValue(state);
      render(<PasswordForm email={EMAIL} />);
      await user.type(
        screen.getByLabelText("Mot de passe actuel"),
        "current password",
      );
      await user.type(
        screen.getByLabelText("Nouveau mot de passe"),
        "a new long passphrase",
      );
      await user.type(screen.getByLabelText(CODE_LABEL), "123456");
      await user.click(
        screen.getByRole("button", { name: "Changer le mot de passe" }),
      );
    }

    it("hints the length, with the right autofill for each field", () => {
      render(<PasswordForm email={EMAIL} />);

      expect(
        screen.getByLabelText("Nouveau mot de passe"),
      ).toHaveAccessibleDescription(/Au moins 15 caractères/);
      expect(screen.getByLabelText("Nouveau mot de passe")).toHaveAttribute(
        "autocomplete",
        "new-password",
      );
      expect(screen.getByLabelText(CODE_LABEL)).toHaveAccessibleName(
        "Code à 6 chiffres (pour changer le mot de passe)",
      );
    });

    it("tells password managers which account changes", async () => {
      await submit({ status: "done", revoked: 0 });

      const sent = actions.changePasswordAction.mock.calls[0]?.[1];
      expect(sent?.get("username")).toBe(EMAIL);
    });

    it.each([
      [{ status: "done", revoked: 0 }, "status", "Mot de passe changé."],
      [
        { status: "done", revoked: 2 },
        "status",
        "2 autres sessions déconnectées.",
      ],
      [
        { status: "invalid", problem: "breached" },
        "alert",
        "fuites de données",
      ],
      [
        { status: "invalid", problem: "too_short" },
        "alert",
        "au moins 15 caractères",
      ],
      [
        { status: "invalid", problem: "contains_context_word" },
        "alert",
        "ni l'adresse e-mail",
      ],
      [{ status: "refused" }, "alert", REFUSED],
    ] as const)("reports %j", async (state, role, text) => {
      await submit(state);

      expect(await screen.findByRole(role)).toHaveTextContent(text);
    });
  });

  describe("SessionsForm", () => {
    const AT = new Date("2026-10-25T12:00:00Z");
    const OTHER = "b".repeat(64);
    const SESSIONS = [
      {
        id: "a".repeat(64),
        device: "Firefox · Linux",
        createdAt: AT,
        lastSeenAt: AT,
        isCurrent: true,
      },
      {
        id: OTHER,
        device: undefined,
        createdAt: AT,
        lastSeenAt: AT,
        isCurrent: false,
      },
    ];

    async function revoke(button: string, code = "123456") {
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(CODE_LABEL), code);
      await user.click(screen.getByRole("button", { name: button }));
      return user;
    }

    it("lists the sessions to choose from, the current one marked", () => {
      render(<SessionsForm sessions={SESSIONS} />);

      const group = screen.getByRole("group", { name: "Sessions à révoquer" });
      const [current, other] = within(group).getAllByRole("checkbox");
      expect(current).toHaveAccessibleName(
        /Firefox · Linux\s*\(cette session\)/,
      );
      expect(other).toHaveAccessibleName(/Appareil inconnu/);
      expect(other).toHaveAttribute("value", OTHER);
    });

    it("sends the chosen sessions, the code and which button was used", async () => {
      const user = userEvent.setup();
      actions.revokeSessionsAction.mockResolvedValue({
        status: "done",
        revoked: 1,
      });
      render(<SessionsForm sessions={SESSIONS} />);

      await user.click(
        screen.getByRole("checkbox", { name: /Appareil inconnu/ }),
      );
      await revoke("Révoquer la sélection");

      const sent = actions.revokeSessionsAction.mock.calls[0]?.[1];
      expect(sent?.getAll("sessionId")).toEqual([OTHER]);
      expect(sent?.get("scope")).toBe("selected");
      expect(sent?.get("code")).toBe("123456");
      expect(await screen.findByRole("status")).toHaveTextContent(
        "1 session révoquée.",
      );
    });

    it("keeps the chosen sessions ticked when the code is refused", async () => {
      actions.revokeSessionsAction.mockResolvedValue({
        status: "refused",
        selected: [OTHER],
      });
      render(<SessionsForm sessions={SESSIONS} />);

      await revoke("Révoquer toutes les autres sessions", "000000");

      expect(
        actions.revokeSessionsAction.mock.calls[0]?.[1]?.get("scope"),
      ).toBe("others");
      expect(await screen.findByRole("alert")).toHaveTextContent(REFUSED);
      expect(
        screen.getByRole("checkbox", { name: /Appareil inconnu/ }),
      ).toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: /cette session/ }),
      ).not.toBeChecked();
    });

    it("asks for a choice when none was made", async () => {
      actions.revokeSessionsAction.mockResolvedValue({
        status: "nothing_selected",
        selected: [],
      });
      render(<SessionsForm sessions={SESSIONS} />);

      await revoke("Révoquer la sélection");

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Sélectionnez au moins une session",
      );
    });
  });

  it("never sends a form twice while it is pending", async () => {
    const user = userEvent.setup();
    let settle: (state: CodeState) => void = () => undefined;
    actions.secondFactorAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    render(<SecondFactorForm />);

    await user.type(screen.getByLabelText("Code à 6 chiffres"), "123456");
    await user.click(screen.getByRole("button", { name: "Vérifier" }));
    const pending = await screen.findByRole("button", {
      name: "Vérification…",
    });
    expect(pending).toHaveAttribute("aria-disabled", "true");
    await user.click(pending);

    expect(actions.secondFactorAction).toHaveBeenCalledOnce();
    await act(() => {
      settle({ status: "idle" });
      return Promise.resolve();
    });
  });
});
