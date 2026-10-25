import { describe, expect, it, vi } from "vitest";

import { err, ok, type Result } from "@/lib/result";

import { createSlugRegistry, type SlugLists } from "./slug-registry";

const SLUGS = { projects: ["portfolio"], experiences: ["acme"] };
const DOWN = err({ code: "DB_UNAVAILABLE", message: "down" });

function setup(responses: () => Result<SlugLists> = () => ok(SLUGS)) {
  let time = 0;
  const load = vi.fn(() => Promise.resolve(responses()));
  const registry = createSlugRegistry({
    load,
    maxAgeMs: 60_000,
    retryAfterMs: 5000,
    now: () => time,
  });
  return {
    load,
    registry,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe("createSlugRegistry", () => {
  it("answers from one load until the slugs are older than the max age", async () => {
    const { load, registry, advance } = setup();

    expect(await registry.has("projects", "portfolio")).toBe(true);
    expect(await registry.has("projects", "ghost")).toBe(false);
    expect(await registry.has("experiences", "acme")).toBe(true);
    expect(load).toHaveBeenCalledOnce();

    advance(60_000);
    await registry.has("projects", "portfolio");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("answers from the last lists at once while a refresh runs", async () => {
    let calls = 0;
    const load = vi.fn(() => {
      calls += 1;
      // The refresh never settles: the answer must not wait for it.
      return calls === 1
        ? Promise.resolve(ok(SLUGS))
        : new Promise<never>(() => undefined);
    });
    let time = 0;
    const registry = createSlugRegistry({
      load,
      maxAgeMs: 60_000,
      retryAfterMs: 5000,
      now: () => time,
    });
    await registry.has("projects", "portfolio");

    time = 60_000;

    expect(await registry.has("projects", "portfolio")).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one load between concurrent questions", async () => {
    const { load, registry } = setup();

    await Promise.all([
      registry.has("projects", "portfolio"),
      registry.has("experiences", "acme"),
    ]);

    expect(load).toHaveBeenCalledOnce();
  });

  it("does not know, and does not retry at once, while the first load fails", async () => {
    const { load, registry, advance } = setup(() => DOWN);

    expect(await registry.has("projects", "portfolio")).toBeUndefined();
    expect(await registry.has("projects", "portfolio")).toBeUndefined();
    expect(load).toHaveBeenCalledOnce();

    advance(5000);
    await registry.has("projects", "portfolio");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("treats a load that throws like a failed one", async () => {
    const { load, registry, advance } = setup(() => {
      throw new Error("boom");
    });

    expect(await registry.has("projects", "portfolio")).toBeUndefined();
    expect(await registry.has("projects", "portfolio")).toBeUndefined();
    expect(load).toHaveBeenCalledOnce();

    advance(5000);
    await registry.has("projects", "portfolio");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps serving the last known slugs when a refresh fails", async () => {
    const responses = [ok(SLUGS), DOWN];
    const { registry, advance } = setup(() => responses.shift() ?? DOWN);
    await registry.has("projects", "portfolio");

    advance(60_000);

    expect(await registry.has("projects", "portfolio")).toBe(true);
  });
});
