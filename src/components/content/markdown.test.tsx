import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Markdown } from "./markdown";

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const MISSING = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

const IMAGES = {
  [ID]: {
    alt: "Schéma de l'architecture",
    width: 960,
    height: 540,
    variants: [
      { width: 480, height: 270, url: "/api/media/media/a/480.webp", bytes: 1 },
      { width: 960, height: 540, url: "/api/media/media/a/960.webp", bytes: 2 },
    ],
  },
};

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

  it("shows an outside image's description instead of the image: the library's only", () => {
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

  it("shows an image of the library alone in its paragraph as a figure, its title the caption", () => {
    const { container } = render(
      <Markdown
        source={`Avant.\n\n![Les trois services](media:${ID} "Vue d'ensemble")\n\nAprès.`}
        images={IMAGES}
      />,
    );

    // Browsers name the figure by its caption; the test library does not.
    const figure = screen.getByRole("figure");
    const image = screen.getByRole("img", { name: "Les trois services" });
    expect(figure).toContainElement(image);
    expect(within(figure).getByText("Vue d'ensemble").tagName).toBe(
      "FIGCAPTION",
    );
    expect(image.getAttribute("srcset")).toBe(
      "/api/media/media/a/480.webp 480w, /api/media/media/a/960.webp 960w",
    );
    expect(image).toHaveAttribute("loading", "lazy");
    expect(container.querySelector("p figure, figure p")).toBeNull();
  });

  it("falls back on the library's text when the Markdown gives none, and needs no figure without a caption", () => {
    render(<Markdown source={`![](media:${ID})`} images={IMAGES} />);

    expect(
      screen.getByRole("img", { name: "Schéma de l'architecture" }),
    ).toBeVisible();
    expect(document.querySelector("figure")).toBeNull();
  });

  it("drops a link left with nothing to name it", () => {
    render(
      <Markdown source="[![](https://x.example/a.png)](https://y.example)" />,
    );

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows an image within a sentence inline, without a figure", () => {
    const { container } = render(
      <Markdown
        source={`Voici ![le schéma](media:${ID}) en ligne.`}
        images={IMAGES}
      />,
    );

    expect(screen.getByRole("img", { name: "le schéma" })).toBeVisible();
    expect(container.querySelector("figure")).toBeNull();
    expect(container.querySelector("p")).toHaveTextContent("Voici en ligne.");
  });

  it("shows the description of an image the library no longer has, and links no media reference", () => {
    const { container } = render(
      <Markdown
        source={`![Ancien schéma](media:${MISSING})\n\n[voir](media:${ID})`}
        images={IMAGES}
      />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Ancien schéma")).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("voir")).toBeVisible();
  });
});
