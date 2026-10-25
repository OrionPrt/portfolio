import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import type * as navigation from "@/i18n/navigation";

import messages from "../../../messages/fr.json";
import { PrimaryNav } from "./primary-nav";

const pathname = vi.hoisted(() => ({ current: "/" }));

vi.mock("@/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof navigation>()),
  usePathname: () => pathname.current,
}));

function renderNav(current: string) {
  pathname.current = current;
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <PrimaryNav />
    </NextIntlClientProvider>,
  );
}

describe("PrimaryNav", () => {
  it("links every section under its French URL", () => {
    renderNav("/");

    expect(screen.getByRole("link", { name: "Projets" })).toHaveAttribute(
      "href",
      "/fr/projets",
    );
    expect(screen.getByRole("link", { name: "Compétences" })).toHaveAttribute(
      "href",
      "/fr/competences",
    );
  });

  it("marks the current section as the page itself", () => {
    renderNav("/projects");

    expect(screen.getByRole("link", { name: "Projets" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks the section of the current page, detail pages included", () => {
    renderNav("/projects/[slug]");

    expect(screen.getByRole("link", { name: "Projets" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "À propos" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
