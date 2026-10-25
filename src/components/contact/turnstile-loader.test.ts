// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TurnstileApi } from "./turnstile-loader";

const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

const API: TurnstileApi = {
  render: () => "widget",
  reset: () => undefined,
  remove: () => undefined,
};

// The loader keeps its pending load per document: each test starts afresh.
async function freshLoader() {
  vi.resetModules();
  const { loadTurnstile } = await import("./turnstile-loader");
  return loadTurnstile;
}

function scripts(): HTMLScriptElement[] {
  return [...document.querySelectorAll("script")];
}

describe("loadTurnstile", () => {
  beforeEach(() => {
    delete window.turnstile;
  });

  afterEach(() => {
    document.head.replaceChildren();
    delete window.turnstile;
  });

  it("adds Cloudflare's script once, signed with the CSP nonce", async () => {
    const loadTurnstile = await freshLoader();

    const first = loadTurnstile("bm9uY2U=");
    const second = loadTurnstile("bm9uY2U=");
    window.turnstile = API;
    scripts()[0]?.dispatchEvent(new Event("load"));

    expect(scripts()).toHaveLength(1);
    expect(scripts()[0]?.src).toBe(SCRIPT_URL);
    expect(scripts()[0]?.nonce).toBe("bm9uY2U=");
    await expect(first).resolves.toBe(API);
    await expect(second).resolves.toBe(API);
  });

  it("uses the script already in the page", async () => {
    const loadTurnstile = await freshLoader();
    window.turnstile = API;

    await expect(loadTurnstile(undefined)).resolves.toBe(API);
    expect(scripts()).toHaveLength(0);
  });

  it("fails when the script cannot load, and lets a later form retry", async () => {
    const loadTurnstile = await freshLoader();

    const failed = loadTurnstile(undefined);
    scripts()[0]?.dispatchEvent(new Event("error"));

    await expect(failed).rejects.toThrow("Turnstile could not load");
    expect(scripts()).toHaveLength(0);
    void loadTurnstile(undefined).catch(() => undefined);
    expect(scripts()).toHaveLength(1);
  });

  it("fails when the script loads without starting Turnstile", async () => {
    const loadTurnstile = await freshLoader();

    const failed = loadTurnstile(undefined);
    scripts()[0]?.dispatchEvent(new Event("load"));

    await expect(failed).rejects.toThrow("Turnstile could not load");
  });
});
