import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MediaImage } from "./media-image";

const IMAGE = {
  alt: "Tableau de bord",
  width: 1600,
  height: 900,
  variants: [
    { width: 480, height: 270, url: "/m/480.webp", bytes: 1 },
    { width: 960, height: 540, url: "/m/960.webp", bytes: 2 },
    { width: 1600, height: 900, url: "/m/1600.webp", bytes: 3 },
  ],
};

describe("MediaImage", () => {
  it("offers each stored width, keeps its proportions, and loads lazily", () => {
    render(<MediaImage image={IMAGE} sizes="100vw" />);

    const image = screen.getByRole("img", { name: "Tableau de bord" });
    expect(image).toHaveAttribute(
      "srcset",
      "/m/480.webp 480w, /m/960.webp 960w, /m/1600.webp 1600w",
    );
    expect(image).toHaveAttribute("src", "/m/1600.webp");
    expect(image).toHaveAttribute("sizes", "100vw");
    expect(image).toHaveAttribute("width", "1600");
    expect(image).toHaveAttribute("height", "900");
    expect(image).toHaveAttribute("loading", "lazy");
  });

  it("is fetched at once when it leads the page, and can adorn silently", () => {
    const { container } = render(
      <MediaImage image={IMAGE} sizes="100vw" alt="" isPriority />,
    );

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
  });

  it("shows nothing for an image without a stored width", () => {
    const { container } = render(
      <MediaImage image={{ ...IMAGE, variants: [] }} sizes="100vw" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
