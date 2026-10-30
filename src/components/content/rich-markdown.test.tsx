import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as Highlighter from "@/features/content/highlighter";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

const mocks = vi.hoisted(() => ({
  loadHighlighter: vi.fn<typeof Highlighter.loadHighlighter>(),
  logError: vi.fn<(event: string, context: object) => void>(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: ({ locale }: { locale: "fr" | "en" }) =>
    Promise.resolve(
      (key: keyof typeof en.Markdown) =>
        (locale === "en" ? en : fr).Markdown[key],
    ),
}));
vi.mock("@/features/content/highlighter", async (importOriginal) => ({
  ...(await importOriginal<typeof Highlighter>()),
  loadHighlighter: mocks.loadHighlighter,
}));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.logError } }));

import { RichMarkdown } from "./rich-markdown";

const { loadHighlighter } = await vi.importActual<typeof Highlighter>(
  "@/features/content/highlighter",
);

const CODE = "```python\nprint('hi')\n```";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadHighlighter.mockImplementation(loadHighlighter);
});

describe("RichMarkdown", () => {
  it("names callouts in the text's language", async () => {
    render(
      await RichMarkdown({ source: ":::warning\nHot.\n:::", locale: "en" }),
    );

    expect(screen.getByRole("note")).toHaveTextContent("Warning");
  });

  it("leaves the highlighter unloaded for a text without fenced code", async () => {
    render(await RichMarkdown({ source: "Plain `code`.", locale: "fr" }));

    expect(mocks.loadHighlighter).not.toHaveBeenCalled();
    expect(screen.getByText("code")).toBeVisible();
  });

  it("colours a fenced code block", async () => {
    const { container } = render(
      await RichMarkdown({ source: CODE, locale: "fr" }),
    );

    expect(container.querySelector("pre.shiki")).not.toBeNull();
  }, 30_000);

  it("shows the code plain, and logs why, when the highlighter fails", async () => {
    mocks.loadHighlighter.mockRejectedValue(new Error("no grammar"));

    const { container } = render(
      await RichMarkdown({ source: CODE, locale: "fr" }),
    );

    expect(container.querySelector("pre.shiki")).toBeNull();
    expect(screen.getByText("print('hi')")).toBeVisible();
    expect(mocks.logError).toHaveBeenCalledWith("markdown.highlighter_failed", {
      error: new Error("no grammar"),
    });
  });
});
