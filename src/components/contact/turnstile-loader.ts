const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** The options of `turnstile.render` this site uses. */
export interface TurnstileRenderOptions {
  readonly sitekey: string;
  readonly action: string;
  readonly language: string;
  readonly theme: "light" | "dark" | "auto";
  readonly size: "flexible" | "compact";
  readonly callback: (token: string) => void;
  readonly "expired-callback": () => void;
  readonly "timeout-callback": () => void;
  readonly "error-callback": () => void;
}

/** The part of Cloudflare's `window.turnstile` this site uses. */
export interface TurnstileApi {
  /** The widget's id, or undefined when it could not be rendered. */
  render(
    container: HTMLElement,
    options: TurnstileRenderOptions,
  ): string | null | undefined;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | undefined;

/**
 * Adds Cloudflare's script once per document. 'strict-dynamic' already trusts
 * a script added by a signed one; the nonce also covers browsers without it.
 * A failed load is forgotten, so the next form tries again.
 */
export function loadTurnstile(
  nonce: string | undefined,
): Promise<TurnstileApi> {
  if (window.turnstile !== undefined) {
    return Promise.resolve(window.turnstile);
  }
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      loading = undefined;
      script.remove();
      reject(new Error("Turnstile could not load"));
    };
    script.src = SCRIPT_URL;
    script.async = true;
    if (nonce !== undefined) {
      script.nonce = nonce;
    }
    script.addEventListener("load", () => {
      if (window.turnstile === undefined) {
        fail();
      } else {
        resolve(window.turnstile);
      }
    });
    script.addEventListener("error", fail);
    document.head.append(script);
  });
  return loading;
}
