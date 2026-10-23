import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs without globals, so Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
});

// jsdom has no matchMedia; components that follow the system theme need one.
// Defaults to a light system preference and never fires change events.
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      // The MediaQueryList type still declares the legacy listener API.
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- required by the MediaQueryList type
      addListener: () => undefined,
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- required by the MediaQueryList type
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) satisfies MediaQueryList,
});
