import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import messages from "../../../messages/fr.json";
import { ThemeSwitcher } from "./theme-switcher";

function renderSwitcher() {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <ThemeSwitcher />
    </NextIntlClientProvider>,
  );
}

describe("ThemeSwitcher", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("offers light, dark and system as a labelled group of radios", () => {
    renderSwitcher();

    const group = screen.getByRole("group", { name: "Thème" });
    const options = screen.getAllByRole("radio");

    expect(group).toBeInTheDocument();
    expect(options.map((option) => option.getAttribute("value"))).toEqual([
      "light",
      "dark",
      "system",
    ]);
    expect(screen.getByLabelText("Clair")).toBeInTheDocument();
    expect(screen.getByLabelText("Sombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Système")).toBeInTheDocument();
  });

  it("follows the system preference until the visitor chooses", () => {
    renderSwitcher();

    expect(screen.getByLabelText("Système")).toBeChecked();
  });

  it("applies the chosen theme and remembers it", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(screen.getByLabelText("Sombre"));

    expect(screen.getByLabelText("Sombre")).toBeChecked();
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("restores a theme chosen on a previous visit", () => {
    localStorage.setItem("theme", "light");

    renderSwitcher();

    expect(screen.getByLabelText("Clair")).toBeChecked();
  });

  // Regression: Cache Components keeps the other locale's header mounted (hidden),
  // so two switchers coexist. Sharing one radio `name` made the browser uncheck
  // the visible one whenever the hidden copy was updated.
  it("keeps its selection when another switcher is mounted in the page", async () => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <div data-testid="visible">
          <ThemeSwitcher />
        </div>
        <div hidden>
          <ThemeSwitcher />
        </div>
      </NextIntlClientProvider>,
    );
    const visible = within(screen.getByTestId("visible"));

    await user.click(visible.getByLabelText("Sombre"));

    expect(visible.getByLabelText("Sombre")).toBeChecked();
  });
});
