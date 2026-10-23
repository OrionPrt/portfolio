"use client";

import { useEffect } from "react";

import { THEME_INIT_SCRIPT } from "@/features/theme/theme-store";
import { getThemeStore } from "@/features/theme/use-theme";

interface ThemeScriptProps {
  /** CSP nonce: the server-rendered copy must run under the policy. */
  readonly nonce?: string;
}

/**
 * Applies the stored theme before first paint. When React re-creates this
 * element on the client (a locale switch remounts the layout), that copy would
 * never run anyway: a non-JavaScript type keeps it inert and avoids React's
 * warning, and the effect applies the theme instead.
 */
export function ThemeScript({ nonce }: ThemeScriptProps) {
  useEffect(() => {
    getThemeStore().apply();
  }, []);

  return (
    <script
      nonce={nonce}
      type={typeof window === "undefined" ? undefined : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
    />
  );
}
