"use client";

import { useLocale } from "next-intl";
import { useEffect, useEffectEvent, useRef } from "react";

import { TURNSTILE_ACTION } from "@/features/contact/form-state";
import { useTheme } from "@/features/theme/use-theme";

import { loadTurnstile, type TurnstileApi } from "./turnstile-loader";

/** Below this width (px), the flexible widget would overflow: compact is 150 px. */
const FLEXIBLE_MIN_WIDTH = 300;

interface RenderedWidget {
  readonly api: TurnstileApi;
  readonly id: string;
}

/** Cloudflare's script may throw (a bad option, a page it refuses). */
function renderSafely(
  api: TurnstileApi,
  ...args: Parameters<TurnstileApi["render"]>
): ReturnType<TurnstileApi["render"]> {
  try {
    return api.render(...args);
  } catch {
    return undefined;
  }
}

interface TurnstileWidgetProps {
  readonly siteKey: string;
  /** The CSP nonce of the page, for Cloudflare's script. */
  readonly nonce: string | undefined;
  /** A new value asks for a new token: each one is accepted only once. */
  readonly resetSignal: unknown;
  readonly onTokenChange: (hasToken: boolean) => void;
  readonly onError: () => void;
}

/**
 * Cloudflare Turnstile, rendered explicitly. The widget adds the
 * `cf-turnstile-response` field to the form around it; the server checks it.
 */
export function TurnstileWidget({
  siteKey,
  nonce,
  resetSignal,
  onTokenChange,
  onError,
}: TurnstileWidgetProps) {
  const locale = useLocale();
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<RenderedWidget>(undefined);
  const widgetTheme = theme === "light" || theme === "dark" ? theme : "auto";
  const reportToken = useEffectEvent(onTokenChange);
  const reportError = useEffectEvent(() => {
    onTokenChange(false);
    onError();
  });

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    let isCancelled = false;
    reportToken(false);
    loadTurnstile(nonce).then(
      (api) => {
        if (isCancelled) {
          return;
        }
        const id = renderSafely(api, container, {
          sitekey: siteKey,
          action: TURNSTILE_ACTION,
          language: locale,
          theme: widgetTheme,
          size:
            container.clientWidth >= FLEXIBLE_MIN_WIDTH
              ? "flexible"
              : "compact",
          callback: () => {
            reportToken(true);
          },
          "expired-callback": () => {
            reportToken(false);
          },
          "timeout-callback": () => {
            reportToken(false);
          },
          "error-callback": () => {
            reportError();
          },
        });
        if (typeof id === "string") {
          widgetRef.current = { api, id };
        } else {
          reportError();
        }
      },
      () => {
        if (!isCancelled) {
          reportError();
        }
      },
    );
    return () => {
      isCancelled = true;
      const widget = widgetRef.current;
      widgetRef.current = undefined;
      widget?.api.remove(widget.id);
    };
  }, [siteKey, nonce, locale, widgetTheme]);

  useEffect(() => {
    const widget = widgetRef.current;
    if (widget === undefined) {
      return;
    }
    reportToken(false);
    widget.api.reset(widget.id);
  }, [resetSignal]);

  // Its height is kept from the start, so the form does not jump when it
  // appears. A page zoomed after loading can make the column narrower than
  // the widget: it scrolls rather than overflowing the page.
  return (
    <div
      ref={containerRef}
      className="min-h-[65px] max-w-full overflow-x-auto"
    />
  );
}
