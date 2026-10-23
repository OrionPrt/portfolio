// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createThemeStore,
  parseTheme,
  resolveTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from "./theme-store";

/** A controllable `prefers-color-scheme: dark` media query. */
function fakeDarkQuery(initiallyDark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: initiallyDark,
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
  };
  const setDark = (dark: boolean): void => {
    query.matches = dark;
    for (const listener of listeners) {
      listener();
    }
  };
  return { query, setDark, listeners };
}

function installMatchMedia(query: ReturnType<typeof fakeDarkQuery>["query"]) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => query,
  });
}

const root = document.documentElement;
const isDark = (): boolean => root.classList.contains("dark");

beforeEach(() => {
  localStorage.clear();
  root.className = "";
  root.style.colorScheme = "";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseTheme and resolveTheme", () => {
  it.each(["light", "dark", "system"] as const)("accepts %s", (theme) => {
    expect(parseTheme(theme)).toBe(theme);
  });

  it.each([null, undefined, "", "blue", "DARK"])(
    "falls back to system for %j",
    (value) => {
      expect(parseTheme(value)).toBe("system");
    },
  );

  it("resolves system from the operating system preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });
});

describe("createThemeStore", () => {
  it("defaults to system and follows the operating system", () => {
    const dark = fakeDarkQuery(true);
    installMatchMedia(dark.query);
    const store = createThemeStore(window);

    store.apply();

    expect(store.getSnapshot()).toBe("system");
    expect(isDark()).toBe(true);
    expect(root.style.colorScheme).toBe("dark");
  });

  it("persists, applies and announces a chosen theme", () => {
    installMatchMedia(fakeDarkQuery(false).query);
    const store = createThemeStore(window);
    const listener = vi.fn();
    store.subscribe(listener);

    store.setTheme("dark");

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(isDark()).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("gives every subscriber the same theme, wherever it was changed", () => {
    installMatchMedia(fakeDarkQuery(false).query);
    // Two stores stand for two mounted copies of the page (one per locale).
    const french = createThemeStore(window);
    const english = createThemeStore(window);
    french.setTheme("dark");

    english.setTheme("light");

    expect(french.getSnapshot()).toBe("light");
    expect(isDark()).toBe(false);
  });

  it("re-applies the stored theme when the page returns from the back-forward cache", () => {
    installMatchMedia(fakeDarkQuery(false).query);
    const store = createThemeStore(window);
    const listener = vi.fn();
    store.subscribe(listener);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );

    expect(isDark()).toBe(true);
    expect(listener).toHaveBeenCalled();
  });

  it("follows a theme chosen in another tab", () => {
    installMatchMedia(fakeDarkQuery(false).query);
    const store = createThemeStore(window);
    store.subscribe(() => undefined);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    window.dispatchEvent(
      new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" }),
    );

    expect(isDark()).toBe(true);
  });

  it("tracks the operating system while set to system", () => {
    const dark = fakeDarkQuery(false);
    installMatchMedia(dark.query);
    const store = createThemeStore(window);
    store.subscribe(() => undefined);

    dark.setDark(true);

    expect(isDark()).toBe(true);
  });

  it("stops listening once the last subscriber leaves", () => {
    const dark = fakeDarkQuery(false);
    installMatchMedia(dark.query);
    const store = createThemeStore(window);
    const unsubscribe = store.subscribe(() => undefined);

    unsubscribe();

    expect(dark.listeners.size).toBe(0);
  });

  it("keeps the choice for the page when storage is unavailable", () => {
    installMatchMedia(fakeDarkQuery(false).query);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const store = createThemeStore(window);

    store.setTheme("dark");

    expect(store.getSnapshot()).toBe("dark");
    expect(isDark()).toBe(true);
  });
});

describe("THEME_INIT_SCRIPT", () => {
  // Evaluates the inline <head> script exactly as the browser does before first paint.
  function runInitScript(): void {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the script under test is a string by design
    const initScript = new Function(THEME_INIT_SCRIPT) as () => void;
    initScript();
  }

  it.each([
    ["dark", false, true],
    ["light", true, false],
    ["system", true, true],
    [null, false, false],
    ["unexpected", true, true],
  ] as const)(
    "applies stored %j with a dark system preference of %s",
    (stored, systemDark, expectedDark) => {
      installMatchMedia(fakeDarkQuery(systemDark).query);
      if (stored !== null) {
        localStorage.setItem(THEME_STORAGE_KEY, stored);
      }

      runInitScript();

      expect(isDark()).toBe(expectedDark);
    },
  );
});
