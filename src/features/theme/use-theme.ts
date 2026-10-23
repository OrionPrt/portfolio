import { useSyncExternalStore } from "react";

import { createThemeStore, type Theme, type ThemeStore } from "./theme-store";

let browserStore: ThemeStore | undefined;

/** One store per document, shared by every mounted copy of the page. */
export function getThemeStore(): ThemeStore {
  browserStore ??= createThemeStore(window);
  return browserStore;
}

const subscribe = (listener: () => void): (() => void) =>
  getThemeStore().subscribe(listener);
const getSnapshot = (): Theme => getThemeStore().getSnapshot();
// The stored theme only exists in the browser: nothing is selected until hydration.
const getServerSnapshot = (): undefined => undefined;
const setTheme = (theme: Theme): void => {
  getThemeStore().setTheme(theme);
};

interface ThemeState {
  readonly theme: Theme | undefined;
  readonly setTheme: (theme: Theme) => void;
}

export function useTheme(): ThemeState {
  const theme = useSyncExternalStore<Theme | undefined>(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return { theme, setTheme };
}
