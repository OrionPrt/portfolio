export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export function parseTheme(value: string | null | undefined): Theme {
  return THEMES.find((theme) => theme === value) ?? "system";
}

export function resolveTheme(
  theme: Theme,
  prefersDark: boolean,
): ResolvedTheme {
  if (theme === "system") {
    return prefersDark ? "dark" : "light";
  }
  return theme;
}

/**
 * Inlined in <head> to theme the page before its first paint. Mirrors
 * `parseTheme` + `resolveTheme`: anything but "light" or "dark" follows the system.
 */
export const THEME_INIT_SCRIPT = `(()=>{try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var d=t==="dark"||(t!=="light"&&matchMedia(${JSON.stringify(
  DARK_SCHEME_QUERY,
)}).matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

export interface ThemeStore {
  getSnapshot(): Theme;
  subscribe(listener: () => void): () => void;
  setTheme(theme: Theme): void;
  /** Applies the current theme to the document, e.g. when a page is mounted again. */
  apply(): void;
}

/**
 * The theme lives in localStorage and on <html>, never in component state:
 * every mounted copy of the page (one per locale under Cache Components'
 * <Activity>) reads the same value, so none can re-apply a stale theme.
 */
export function createThemeStore(win: Window): ThemeStore {
  const listeners = new Set<() => void>();
  const darkQuery = win.matchMedia(DARK_SCHEME_QUERY);
  // Used only when storage is unavailable (blocked cookies, some private modes).
  let unsavedTheme: Theme | undefined;

  const read = (): Theme => {
    try {
      return parseTheme(win.localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      return unsavedTheme ?? "system";
    }
  };

  const apply = (): void => {
    const resolved = resolveTheme(read(), darkQuery.matches);
    const root = win.document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
  };

  const refresh = (): void => {
    apply();
    for (const listener of listeners) {
      listener();
    }
  };

  const onStorage = (event: StorageEvent): void => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      refresh();
    }
  };

  const onPageShow = (event: PageTransitionEvent): void => {
    if (event.persisted) {
      refresh();
    }
  };

  const listen = (): void => {
    darkQuery.addEventListener("change", refresh);
    win.addEventListener("storage", onStorage);
    win.addEventListener("pageshow", onPageShow);
  };

  const stopListening = (): void => {
    darkQuery.removeEventListener("change", refresh);
    win.removeEventListener("storage", onStorage);
    win.removeEventListener("pageshow", onPageShow);
  };

  return {
    getSnapshot: read,
    apply,
    subscribe(listener) {
      if (listeners.size === 0) {
        listen();
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stopListening();
        }
      };
    },
    setTheme(theme) {
      try {
        win.localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        unsavedTheme = theme;
      }
      refresh();
    },
  };
}
