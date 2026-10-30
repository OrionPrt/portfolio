import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { outlineOf } from "@/features/content/markdown-outline";

import { postSummary, postView } from "../../../test/fixtures/views";
import { renderWithIntl } from "../../../test/render";
import { PostCard } from "./post-card";
import { PostDetail, postHeadingPrefix } from "./post-detail";

// An async server component: the plain renderer stands in for it under jsdom.
vi.mock(
  "@/components/content/rich-markdown",
  () => import("../../../test/mocks/rich-markdown"),
);

describe("PostCard", () => {
  it("links the post, and says what kind it is, from where and when", () => {
    renderWithIntl(<PostCard post={postSummary()} />);
    const card = screen.getByRole("article", { name: "Pwning a box" });

    expect(
      within(card).getByRole("link", { name: "Pwning a box" }),
    ).toHaveAttribute("href", "/fr/blog/a-box");
    expect(card).toHaveTextContent("write-up");
    expect(card).toHaveTextContent("Hack The Box · difficile");
    expect(within(card).getByText("1 octobre 2026")).toHaveAttribute(
      "datetime",
      "2026-10-01",
    );
  });

  it("marks a post written in the other language only", () => {
    renderWithIntl(
      <PostCard
        post={postSummary({
          locales: ["en"],
          contentLocale: "en",
          isFallback: true,
        })}
      />,
    );
    const card = screen.getByRole("article", { name: "Pwning a box" });

    expect(card).toHaveTextContent("en anglais");
    expect(within(card).getByRole("heading")).toHaveAttribute("lang", "en");
  });
});

describe("PostDetail", () => {
  const post = postView();
  const outline = outlineOf(post.bodyMd, postHeadingPrefix(post.slug, "fr"));

  it("lists its sections, each link reaching its heading", () => {
    const { container } = renderWithIntl(
      <PostDetail
        post={post}
        outline={outline}
        neighbours={{ older: undefined, newer: undefined }}
      />,
    );
    const toc = screen.getByRole("navigation", { name: "Sommaire" });
    const links = within(toc).getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      "Recon",
      "Foothold",
    ]);
    for (const link of links) {
      const id = (link.getAttribute("href") ?? "").slice(1);
      expect(container.querySelector(`[id="${id}"]`)).not.toBeNull();
    }
    expect(screen.getByText("1 min de lecture")).toBeVisible();
  });

  it("leads to the posts either side of it", () => {
    renderWithIntl(
      <PostDetail
        post={post}
        outline={outline}
        neighbours={{
          older: postSummary({ slug: "older", title: "Older one" }),
          newer: undefined,
        }}
      />,
    );
    const neighbours = screen.getByRole("navigation", {
      name: "Autres articles",
    });

    expect(
      within(neighbours).getByRole("link", {
        name: "Article précédent Older one",
      }),
    ).toHaveAttribute("href", "/fr/blog/older");
  });

  it("says when a write-up's challenge was retired", () => {
    renderWithIntl(
      <PostDetail
        post={post}
        outline={outline}
        neighbours={{ older: undefined, newer: undefined }}
      />,
    );

    const day = screen.getByText("1 septembre 2026");
    expect(day).toHaveAttribute("datetime", "2026-09-01");
    expect(day.parentElement).toHaveTextContent(
      "Retrait du challenge : 1 septembre 2026",
    );
  });

  it("goes without a table of contents under two sections, its text kept", () => {
    const short = postView({
      kind: "article",
      platform: null,
      difficulty: null,
      retiredOn: null,
      bodyMd: "## Only\n\nOne part.",
    });
    renderWithIntl(
      <PostDetail
        post={short}
        outline={outlineOf(short.bodyMd, "p-")}
        neighbours={{ older: undefined, newer: undefined }}
      />,
    );

    expect(screen.queryByRole("navigation", { name: "Sommaire" })).toBeNull();
    expect(screen.getByText("One part.")).toBeVisible();
    expect(screen.queryByText(/Retrait du challenge/)).toBeNull();
  });
});
