import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";
import { TwoLevelContent } from "./two-level-content";

// An async server component: the plain renderer stands in for it under jsdom.
vi.mock(
  "@/components/content/rich-markdown",
  () => import("../../../test/mocks/rich-markdown"),
);

const SUMMARY = {
  context: "Le contexte.",
  action: "L'action.",
  result: "Le résultat.",
};

function renderContent(technicalMd: string) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <TwoLevelContent
        idPrefix="demo-fr"
        summary={SUMMARY}
        technicalMd={technicalMd}
      />
    </NextIntlClientProvider>,
  );
}

describe("TwoLevelContent", () => {
  it("shows the essentials to everyone: context, action, result", () => {
    renderContent("");

    expect(
      screen.getByRole("heading", { level: 2, name: "L'essentiel" }),
    ).toBeVisible();
    expect(screen.getByText("Contexte")).toBeVisible();
    expect(screen.getByText("Le contexte.")).toBeVisible();
    expect(screen.getByText("Le résultat.")).toBeVisible();
  });

  it("folds the technical details, which open without JavaScript", async () => {
    const user = userEvent.setup();
    renderContent("## Architecture\n\nDes détails.");
    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Détails techniques",
    });
    const details = heading.closest("details");

    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");

    await user.click(heading);

    expect(details).toHaveAttribute("open");
    expect(
      screen.getByRole("heading", { level: 3, name: "Architecture" }),
    ).toBeInTheDocument();
  });

  it("leaves the technical part out when there is none", () => {
    renderContent("   ");

    expect(screen.queryByText("Détails techniques")).toBeNull();
  });
});
