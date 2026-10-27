import { act, screen, waitFor } from "@testing-library/react";
import { Activity } from "react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HONEYPOT_FIELD,
  INITIAL_CONTACT_STATE,
  type ContactFormState,
} from "@/features/contact/form-state";

import { renderWithIntl } from "../../../test/render";
import { ContactForm } from "./contact-form";
import type { TurnstileApi, TurnstileRenderOptions } from "./turnstile-loader";
import { regionWith } from "../../../test/dom";

const VALUES = {
  name: "Ada",
  email: "ada@example.com",
  subject: "Une mission",
  message: "Bonjour, j'ai un projet.",
};

type Action = (
  state: ContactFormState,
  formData: FormData,
) => Promise<ContactFormState>;

/** Stands in for Cloudflare: adds the token field, and issues a token unless told not to. */
function fakeTurnstile({ issuesToken = true } = {}) {
  let options: TurnstileRenderOptions | undefined;
  const api = {
    render: vi.fn(
      (container: HTMLElement, rendered: TurnstileRenderOptions) => {
        options = rendered;
        const field = document.createElement("input");
        field.type = "hidden";
        field.name = "cf-turnstile-response";
        field.value = "token";
        container.append(field);
        if (issuesToken) {
          rendered.callback("token");
        }
        return "widget-1";
      },
    ),
    reset: vi.fn(),
    remove: vi.fn(),
  } satisfies TurnstileApi;
  window.turnstile = api;
  return {
    api,
    options: () => {
      if (options === undefined) {
        throw new Error("The widget was not rendered");
      }
      return options;
    },
  };
}

async function renderForm(
  action: Action = vi.fn(() =>
    Promise.resolve<ContactFormState>({ status: "sent" }),
  ),
) {
  const user = userEvent.setup();
  renderWithIntl(
    <ContactForm action={action} siteKey="site-key" nonce={undefined} />,
  );
  // Lets the widget load (a resolved promise) inside act.
  await act(() => Promise.resolve());
  return { user, action };
}

async function fill(user: UserEvent) {
  await user.type(screen.getByLabelText("Nom"), VALUES.name);
  await user.type(screen.getByLabelText("E-mail"), VALUES.email);
  await user.type(screen.getByLabelText("Objet"), VALUES.subject);
  await user.type(screen.getByLabelText("Message"), VALUES.message);
}

function submitButton() {
  return screen.getByRole("button", { name: "Envoyer" });
}

function invalidEmail(): Action {
  return vi.fn(() =>
    Promise.resolve<ContactFormState>({
      status: "invalid",
      errors: { email: "invalid", message: "too_short" },
      // As the server read them: the form shows these, not its own state.
      values: { ...VALUES, name: "Ada L." },
    }),
  );
}

describe("ContactForm", () => {
  afterEach(() => {
    delete window.turnstile;
  });

  it("labels every field and keeps the honeypot away from people", async () => {
    fakeTurnstile();
    await renderForm();

    expect(
      screen.getByRole("form", { name: "Écrire un message" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Tous les champs sont obligatoires."),
    ).toBeVisible();
    const name = screen.getByRole("textbox", { name: "Nom" });
    expect(name).toBeRequired();
    expect(name).toHaveAttribute("autocomplete", "name");
    expect(name).toHaveAttribute("maxlength", "100");
    expect(screen.getByRole("textbox", { name: "E-mail" })).toHaveAttribute(
      "type",
      "email",
    );
    const message = screen.getByRole("textbox", { name: "Message" });
    expect(message).toHaveAttribute("minlength", "10");
    expect(message).toHaveAttribute("maxlength", "5000");
    expect(message).toHaveAccessibleDescription(/^Entre 10 et 5\s?000/);
    // Out of reach: no focus, no pointer, nothing for assistive technologies.
    const honeypot = screen.getByLabelText("Ne pas remplir ce champ");
    expect(honeypot).toHaveAttribute("name", HONEYPOT_FIELD);
    expect(honeypot.closest("[inert]")).not.toBeNull();
  });

  it("explains the wait for the anti-bot check, and holds the form until then", async () => {
    const turnstile = fakeTurnstile({ issuesToken: false });
    const { user, action } = await renderForm();
    await fill(user);

    // Still focusable, so its description can be heard.
    expect(submitButton()).toHaveAttribute("aria-disabled", "true");
    expect(submitButton()).toHaveAccessibleDescription(
      "Vérification anti-robot en cours…",
    );
    await user.click(submitButton());
    expect(action).not.toHaveBeenCalled();

    act(() => {
      turnstile.options().callback("token");
    });
    expect(submitButton()).not.toHaveAttribute("aria-disabled");
    expect(submitButton()).not.toHaveAccessibleDescription();
  });

  it("sends the message with the page's locale and the token, then empties the form", async () => {
    const turnstile = fakeTurnstile();
    const { user, action } = await renderForm();

    await fill(user);
    await user.click(submitButton());

    await regionWith(screen, "status", "Message envoyé, merci.");
    const [state, data] = vi.mocked(action).mock.calls[0] ?? [];
    expect(state).toEqual(INITIAL_CONTACT_STATE);
    expect(data && Object.fromEntries(data)).toEqual({
      ...VALUES,
      locale: "fr",
      [HONEYPOT_FIELD]: "",
      "cf-turnstile-response": "token",
    });
    expect(screen.getByLabelText("Nom")).toHaveValue("");
    // A token is accepted once: the next message needs another.
    expect(turnstile.api.reset).toHaveBeenCalledWith("widget-1");
  });

  it("points out each invalid field, keeps what was typed and focuses the first", async () => {
    fakeTurnstile();
    const { user } = await renderForm(invalidEmail());

    await fill(user);
    await user.click(submitButton());

    // Politely: the focus move already announces the first field's error.
    await regionWith(screen, "status", "Le message n'est pas parti");
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
    const email = screen.getByLabelText("E-mail");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription(
      /^Cette adresse e-mail n'est pas valide \(exemple/,
    );
    expect(email).toHaveFocus();
    expect(screen.getByLabelText("Message")).toHaveAccessibleDescription(
      /Le message doit contenir au moins 10 caractères\./,
    );
    expect(screen.getByLabelText("Nom")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Nom")).toHaveValue("Ada L.");
    expect(screen.getByLabelText("Message")).toHaveValue(VALUES.message);
  });

  it("does not take the focus back when the page is shown again", async () => {
    fakeTurnstile();
    const user = userEvent.setup();
    const action = invalidEmail();
    const page = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <ContactForm action={action} siteKey="site-key" nonce={undefined} />
      </Activity>
    );
    const { rerender } = renderWithIntl(page("visible"));
    await act(() => Promise.resolve());
    await fill(user);
    await user.click(submitButton());
    await waitFor(() => {
      expect(screen.getByLabelText("E-mail")).toHaveFocus();
    });

    screen.getByLabelText("Objet").focus();
    rerender(page("hidden"));
    rerender(page("visible"));
    await act(() => Promise.resolve());

    expect(screen.getByLabelText("E-mail")).not.toHaveFocus();
  });

  it.each([
    ["captcha", "La vérification anti-robot a échoué"],
    ["rate_limited", "Trop de messages"],
    ["unavailable", "Le formulaire est momentanément indisponible"],
  ] as const)(
    "explains a %s refusal and keeps the message",
    async (reason, text) => {
      fakeTurnstile();
      const { user } = await renderForm(
        vi.fn(() =>
          Promise.resolve<ContactFormState>({
            status: "failed",
            reason,
            values: VALUES,
          }),
        ),
      );

      await fill(user);
      await user.click(submitButton());

      await regionWith(screen, "alert", text);
      expect(screen.getByLabelText("Message")).toHaveValue(VALUES.message);
    },
  );

  it("keeps the message when the request itself fails", async () => {
    fakeTurnstile();
    const { user } = await renderForm(() =>
      Promise.reject(new Error("Failed to fetch")),
    );

    await fill(user);
    await user.click(submitButton());

    await regionWith(
      screen,
      "alert",
      "Le formulaire est momentanément indisponible",
    );
    expect(screen.getByLabelText("Message")).toHaveValue(VALUES.message);
  });

  it("says so when the anti-bot check cannot load, until it recovers", async () => {
    const turnstile = fakeTurnstile({ issuesToken: false });
    await renderForm();

    act(() => {
      turnstile.options()["error-callback"]();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "La vérification anti-robot n'a pas pu se charger",
    );
    expect(submitButton()).toHaveAttribute("aria-disabled", "true");
    expect(submitButton()).not.toHaveAccessibleDescription();

    act(() => {
      turnstile.options().callback("token");
    });
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });

  it("says the message is on its way, and cannot be sent twice", async () => {
    fakeTurnstile();
    let settle: (state: ContactFormState) => void = () => undefined;
    const action = vi.fn(
      () =>
        new Promise<ContactFormState>((resolve) => {
          settle = resolve;
        }),
    );
    const { user } = await renderForm(action);

    await fill(user);
    await user.click(submitButton());

    expect(screen.getByRole("status")).toHaveTextContent("Envoi du message…");
    expect(submitButton()).toHaveAttribute("aria-disabled", "true");
    await user.click(submitButton());
    expect(action).toHaveBeenCalledOnce();
    await act(() => {
      settle({ status: "sent" });
      return Promise.resolve();
    });
  });
});
