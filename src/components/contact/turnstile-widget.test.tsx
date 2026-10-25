import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getThemeStore } from "@/features/theme/use-theme";

import { renderWithIntl } from "../../../test/render";
import type { TurnstileApi, TurnstileRenderOptions } from "./turnstile-loader";
import { TurnstileWidget } from "./turnstile-widget";

function fakeTurnstile() {
  const rendered: TurnstileRenderOptions[] = [];
  const api = {
    render: vi.fn(
      (_container: HTMLElement, options: TurnstileRenderOptions) => {
        rendered.push(options);
        return "widget-1";
      },
    ),
    reset: vi.fn(),
    remove: vi.fn(),
  } satisfies TurnstileApi;
  window.turnstile = api;
  return { api, last: () => rendered.at(-1) };
}

function renderWidget(
  props: Partial<Parameters<typeof TurnstileWidget>[0]> = {},
  locale: "fr" | "en" = "fr",
) {
  const handlers = { onTokenChange: vi.fn(), onError: vi.fn() };
  const view = renderWithIntl(
    <TurnstileWidget
      siteKey="site-key"
      nonce={undefined}
      resetSignal={0}
      {...handlers}
      {...props}
    />,
    locale,
  );
  return { ...view, ...handlers };
}

/** jsdom lays nothing out: every element is 0 px wide unless told otherwise. */
function setColumnWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
}

describe("TurnstileWidget", () => {
  beforeEach(() => {
    localStorage.clear();
    setColumnWidth(600);
  });

  afterEach(() => {
    delete window.turnstile;
    vi.restoreAllMocks();
    // The theme store lives as long as the document: back to the default.
    getThemeStore().setTheme("system");
    localStorage.clear();
  });

  it("renders the contact widget in the page's language and theme", async () => {
    const { api, last } = fakeTurnstile();

    renderWidget({}, "en");

    await waitFor(() => {
      expect(api.render).toHaveBeenCalledOnce();
    });
    expect(last()).toMatchObject({
      sitekey: "site-key",
      action: "contact",
      language: "en",
      theme: "auto",
      size: "flexible",
    });
  });

  it("falls back to the compact widget in a narrow column", async () => {
    setColumnWidth(240);
    const { api, last } = fakeTurnstile();

    renderWidget();

    await waitFor(() => {
      expect(api.render).toHaveBeenCalled();
    });
    expect(last()?.size).toBe("compact");
  });

  it("follows the theme chosen on the site", async () => {
    localStorage.setItem("theme", "dark");
    const { api, last } = fakeTurnstile();

    renderWidget();

    await waitFor(() => {
      expect(api.render).toHaveBeenCalled();
    });
    expect(last()?.theme).toBe("dark");
  });

  it("reports when a token is issued, and when it expires", async () => {
    const { api, last } = fakeTurnstile();
    const { onTokenChange } = renderWidget();
    await waitFor(() => {
      expect(api.render).toHaveBeenCalled();
    });

    last()?.callback("token");
    expect(onTokenChange).toHaveBeenLastCalledWith(true);
    last()?.["expired-callback"]();
    expect(onTokenChange).toHaveBeenLastCalledWith(false);
    last()?.["timeout-callback"]();
    expect(onTokenChange).toHaveBeenLastCalledWith(false);
  });

  it("asks for a new token after each submission", async () => {
    const { api, last } = fakeTurnstile();
    const { rerender, onTokenChange, onError } = renderWidget();
    await waitFor(() => {
      expect(api.render).toHaveBeenCalled();
    });
    last()?.callback("token");

    rerender(
      <TurnstileWidget
        siteKey="site-key"
        nonce={undefined}
        resetSignal={1}
        onTokenChange={onTokenChange}
        onError={onError}
      />,
    );

    expect(api.reset).toHaveBeenCalledWith("widget-1");
    expect(onTokenChange).toHaveBeenLastCalledWith(false);
  });

  it("reports a widget that fails", async () => {
    const { api, last } = fakeTurnstile();
    const { onError, onTokenChange } = renderWidget();
    await waitFor(() => {
      expect(api.render).toHaveBeenCalled();
    });

    last()?.["error-callback"]();

    expect(onError).toHaveBeenCalledOnce();
    expect(onTokenChange).toHaveBeenLastCalledWith(false);
  });

  it("reports a widget that cannot be rendered", async () => {
    const { api } = fakeTurnstile();
    api.render.mockReturnValue(undefined as unknown as string);

    const { onError } = renderWidget();

    await waitFor(() => {
      expect(onError).toHaveBeenCalledOnce();
    });
  });

  it("reports a widget whose script throws", async () => {
    const { api } = fakeTurnstile();
    api.render.mockImplementation(() => {
      throw new Error("Invalid sitekey");
    });

    const { onError } = renderWidget();

    await waitFor(() => {
      expect(onError).toHaveBeenCalledOnce();
    });
  });

  it("renders the widget again, once, when the site's theme changes", async () => {
    const { api, last } = fakeTurnstile();
    renderWidget();
    await waitFor(() => {
      expect(api.render).toHaveBeenCalledOnce();
    });

    act(() => {
      getThemeStore().setTheme("dark");
    });

    await waitFor(() => {
      expect(api.render).toHaveBeenCalledTimes(2);
    });
    expect(api.remove).toHaveBeenCalledWith("widget-1");
    expect(last()?.theme).toBe("dark");
  });

  it("removes the widget when the form goes away", async () => {
    const { api } = fakeTurnstile();
    const { unmount } = renderWidget();
    await waitFor(() => {
      expect(api.render).toHaveBeenCalled();
    });

    unmount();

    expect(api.remove).toHaveBeenCalledWith("widget-1");
  });
});
