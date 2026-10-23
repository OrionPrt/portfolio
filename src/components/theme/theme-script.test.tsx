import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { THEME_STORAGE_KEY } from "@/features/theme/theme-store";

import { ThemeScript } from "./theme-script";

describe("ThemeScript", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.className = "";
  });

  // A locale switch remounts the layout on the client, which re-creates the
  // script: React warns about any executable <script> it creates.
  it("renders on the client without React's script-tag warning", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(<ThemeScript nonce="bm9uY2U=" />);

    const scriptWarnings = consoleError.mock.calls.filter(([message]) =>
      String(message).includes("Encountered a script tag"),
    );
    expect(scriptWarnings).toEqual([]);
  });

  it("keeps the client copy inert", () => {
    const { container } = render(<ThemeScript />);

    expect(container.querySelector("script")?.getAttribute("type")).toBe(
      "text/plain",
    );
  });

  it("applies the stored theme when it mounts", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    render(<ThemeScript />);

    expect(document.documentElement).toHaveClass("dark");
  });
});
