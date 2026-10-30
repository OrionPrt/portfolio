import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ContentFormState } from "@/features/admin/content-form-state";
import type { PostListEntry } from "@/features/posts/admin-repository";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/posts/admin-actions", () => ({
  createPostAction: vi.fn(),
  updatePostAction: vi.fn(),
  deletePostAction: vi.fn(),
}));

import { PostForm } from "./post-form";
import { PostList } from "./post-list";

const SKILLS = [{ slug: "rust", name: "Rust", domain: "low_level" }] as const;

const POST: PostListEntry = {
  id: "post-1",
  slug: "a-box",
  kind: "writeup",
  status: "published",
  publishedOn: "2026-09-01",
  showsOn: "2026-09-01",
  title: "Pwning a box",
  locales: ["en"],
};

describe("PostList", () => {
  it("lists the drafts apart, each post with its kind and languages", () => {
    render(
      <PostList
        posts={[
          POST,
          {
            ...POST,
            id: "post-2",
            slug: "brouillon",
            kind: "article",
            status: "draft",
            publishedOn: null,
            showsOn: null,
            title: "Brouillon",
            locales: ["fr", "en"],
          },
        ]}
      />,
    );

    const drafts = screen.getByRole("region", { name: "Brouillons" });
    expect(within(drafts).getByRole("listitem")).toHaveTextContent(
      "Brouillon Article FR EN",
    );
    const published = screen.getByRole("region", { name: "Publiés" });
    const [box] = within(published).getAllByRole("listitem");
    expect(box).toHaveTextContent("Pwning a box Write-up EN");
    expect(box).toHaveTextContent("1 septembre 2026");
    expect(box).not.toHaveTextContent("Prévu");
    expect(
      within(box ?? document.body).getByRole("link", {
        name: "Modifier Pwning a box",
      }),
    ).toHaveAttribute("href", "/admin/posts/post-1");
  });

  it("marks a post the site does not show yet with the day it will", () => {
    render(<PostList posts={[{ ...POST, showsOn: "2999-01-01" }]} />);

    expect(screen.getByRole("listitem")).toHaveTextContent(
      "Prévu le 1 janvier 2999",
    );
  });
});

describe("PostForm", () => {
  it("announces a post sent in no language, which no field can show", async () => {
    const user = userEvent.setup();
    const save =
      vi.fn<
        (state: ContentFormState, data: FormData) => Promise<ContentFormState>
      >();
    save.mockResolvedValue({
      status: "invalid",
      problems: { language: { problem: "required" } },
    });
    const { container } = render(
      <PostForm action={save} skills={SKILLS} media={[]} />,
    );
    container.querySelector("form")?.setAttribute("novalidate", "");

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(
        screen.getByText("Écrivez l'article dans au moins une langue."),
      ).toHaveAttribute("role", "alert");
    });
  });

  it("offers no platform or difficulty under a dash, but as none", () => {
    render(<PostForm action={vi.fn()} skills={SKILLS} media={[]} />);

    expect(screen.getByLabelText("Plateforme")).toHaveDisplayValue("Aucune");
    expect(screen.getByLabelText("Difficulté")).toHaveDisplayValue("Aucune");
  });
});
