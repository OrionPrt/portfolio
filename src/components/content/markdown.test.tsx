import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Markdown } from "./markdown";

describe("Markdown", () => {
  it("renders GFM, with headings below the page's own", () => {
    render(<Markdown source={"# Stack\n\n- Next.js\n- [x] done"} />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Stack" }),
    ).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shifts every heading level under the page's own", () => {
    render(
      <Markdown
        source={"## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six"}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "Two" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 4, name: "Three" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 5, name: "Four" }),
    ).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 6 })).toHaveLength(2);
  });

  it("starts at h2 when the page has no section heading above it", () => {
    render(<Markdown source={"# Parcours\n\n## Détails"} topLevel={2} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Parcours" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 2, name: "Détails" }),
    ).toBeVisible();
  });

  it("lets keyboard users reach wide code blocks and tables", () => {
    const { container } = render(
      <Markdown source={"```\ncode\n```\n\n| a |\n| - |\n| b |"} />,
    );

    expect(container.querySelector("pre")).toHaveAttribute("tabindex", "0");
    expect(container.querySelector("table")).toHaveAttribute("tabindex", "0");
  });

  it("drops raw HTML from the source", () => {
    const { container } = render(
      <Markdown
        source={
          'Hello <img src=x onerror="alert(1)"> <script>alert(1)</script>'
        }
      />,
    );

    expect(container.querySelector("img, script")).toBeNull();
    expect(container).toHaveTextContent("Hello");
  });

  it("shows an image's description instead of the image, until media storage exists", () => {
    const { container } = render(
      <Markdown source="![Architecture diagram](https://cdn.example/a.png)" />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Architecture diagram")).toBeVisible();
  });

  it("keeps the text of an unsafe link but not the link", () => {
    render(
      <Markdown source="[click](javascript:alert(1)) [site](https://example.com)" />,
    );

    expect(screen.queryByRole("link", { name: "click" })).toBeNull();
    expect(screen.getByText("click")).toBeVisible();
    expect(screen.getByRole("link", { name: "site" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });
});
