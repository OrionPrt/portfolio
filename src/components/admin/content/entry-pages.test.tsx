import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ADMIN_COPY } from "../copy";
import { EntryMissing, ListIntro } from "./entry-pages";

describe("ListIntro", () => {
  it("says what the list holds, and links to a new entry", () => {
    render(
      <ListIntro
        lead="Les certifications."
        addHref="/admin/certifications/new"
        addLabel="Nouvelle certification"
      />,
    );

    expect(screen.getByText("Les certifications.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Nouvelle certification" }),
    ).toHaveAttribute("href", "/admin/certifications/new");
  });
});

describe("EntryMissing", () => {
  it("tells an entry gone from a database out of reach", () => {
    const { rerender } = render(
      <EntryMissing isAvailable notFound="Cette entrée n'existe pas." />,
    );
    expect(screen.getByText("Cette entrée n'existe pas.")).not.toHaveClass(
      "text-danger",
    );

    rerender(
      <EntryMissing
        isAvailable={false}
        notFound="Cette entrée n'existe pas."
      />,
    );
    expect(screen.getByText(ADMIN_COPY.unavailable)).toHaveClass("text-danger");
  });
});
