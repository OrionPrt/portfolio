import { describe, expect, it, vi } from "vitest";

import { err, ok, type Result } from "@/lib/result";

import {
  createSlugRegistry,
  resolveSlug,
  type SlugLists,
} from "./slug-registry";

const SLUGS: SlugLists = {
  published: {
    projects: ["portfolio", "new-name"],
    experiences: ["acme"],
    posts: ["a-box"],
  },
  redirects: [
    { collection: "projects", fromSlug: "old-name", toSlug: "new-name" },
    // Its target is a draft: the old address is gone.
    { collection: "projects", fromSlug: "older", toSlug: "draft" },
  ],
};
const DOWN = err({ code: "DB_UNAVAILABLE", message: "down" });

function setup(responses: () => Result<SlugLists> = () => ok(SLUGS)) {
  let time = 0;
  const load = vi.fn(() => Promise.resolve(responses()));
  const registry = createSlugRegistry({
    load,
    maxAgeMs: 60_000,
    retryAfterMs: 5000,
    missRefreshAfterMs: 5000,
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

describe("resolveSlug", () => {
  it.each([
    ["portfolio", { kind: "published" }],
    ["old-name", { kind: "redirect", to: "new-name" }],
    ["older", { kind: "missing" }],
    ["acme", { kind: "missing" }],
  ] as const)("resolves the project %s in lists at hand", (slug, expected) => {
    expect(resolveSlug(SLUGS, "projects", slug)).toEqual(expected);
  });
});

describe("createSlugRegistry", () => {
  it("tells published slugs, old slugs that lead to them, and the rest", async () => {
    const { registry } = setup();

    expect(await registry.resolve("projects", "portfolio")).toEqual({
      kind: "published",
    });
    expect(await registry.resolve("projects", "old-name")).toEqual({
      kind: "redirect",
      to: "new-name",
    });
    expect(await registry.resolve("projects", "older")).toEqual({
      kind: "missing",
    });
    expect(await registry.resolve("experiences", "portfolio")).toEqual({
      kind: "missing",
    });
  });

  it("answers from one load until the slugs are older than the max age", async () => {
    const { load, registry, advance } = setup();

    await registry.resolve("projects", "portfolio");
    await registry.resolve("experiences", "acme");
    expect(load).toHaveBeenCalledOnce();

    advance(60_000);
    await registry.resolve("projects", "portfolio");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("looks again for a slug it misses, once the lists are a few seconds old", async () => {
    const lists = [
      ok(SLUGS),
      ok({
        ...SLUGS,
        published: { ...SLUGS.published, projects: ["just-published"] },
      }),
    ];
    const { load, registry, advance } = setup(() => lists.shift() ?? DOWN);
    expect(await registry.resolve("projects", "just-published")).toEqual({
      kind: "missing",
    });
    // Too fresh: a burst of unknown slugs costs one load, not one each.
    expect(await registry.resolve("projects", "other")).toEqual({
      kind: "missing",
    });
    expect(load).toHaveBeenCalledOnce();

    advance(5000);

    expect(await registry.resolve("projects", "just-published")).toEqual({
      kind: "published",
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not load for every miss while the database is down", async () => {
    const responses = [ok(SLUGS)];
    const { load, registry, advance } = setup(() => responses.shift() ?? DOWN);
    await registry.resolve("projects", "portfolio");
    advance(5000);

    await registry.resolve("projects", "ghost-1");
    await registry.resolve("projects", "ghost-2");
    await registry.resolve("projects", "ghost-3");

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
      missRefreshAfterMs: 5000,
      now: () => time,
    });
    await registry.resolve("projects", "portfolio");

    time = 60_000;

    expect(await registry.resolve("projects", "portfolio")).toEqual({
      kind: "published",
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one load between concurrent questions", async () => {
    const { load, registry } = setup();

    await Promise.all([
      registry.resolve("projects", "portfolio"),
      registry.resolve("experiences", "acme"),
    ]);

    expect(load).toHaveBeenCalledOnce();
  });

  it("does not know, and does not retry at once, while the first load fails", async () => {
    const { load, registry, advance } = setup(() => DOWN);

    expect(await registry.resolve("projects", "portfolio")).toBeUndefined();
    expect(await registry.resolve("projects", "portfolio")).toBeUndefined();
    expect(load).toHaveBeenCalledOnce();

    advance(5000);
    await registry.resolve("projects", "portfolio");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("treats a load that throws like a failed one", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { load, registry, advance } = setup(() => {
      throw new Error("boom");
    });

    expect(await registry.resolve("projects", "portfolio")).toBeUndefined();
    expect(load).toHaveBeenCalledOnce();

    advance(5000);
    await registry.resolve("projects", "portfolio");
    expect(load).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it("keeps serving the last known slugs when a refresh fails", async () => {
    const responses = [ok(SLUGS), DOWN];
    const { registry, advance } = setup(() => responses.shift() ?? DOWN);
    await registry.resolve("projects", "portfolio");

    advance(60_000);

    expect(await registry.resolve("projects", "portfolio")).toEqual({
      kind: "published",
    });
  });

  it("answers a miss from the lists at hand while a load hangs, rather than wait on it", async () => {
    let time = 0;
    const load = vi
      .fn<() => Promise<Result<SlugLists>>>()
      .mockResolvedValueOnce(ok(SLUGS))
      .mockReturnValue(new Promise(() => undefined));
    const registry = createSlugRegistry({
      load,
      maxAgeMs: 60_000,
      retryAfterMs: 5000,
      missRefreshAfterMs: 5000,
      now: () => time,
    });
    await registry.resolve("projects", "portfolio");
    time += 6000;
    // This miss starts a load that never ends, and waits on it.
    void registry.resolve("projects", "first-miss");
    time += 6000;

    await expect(registry.resolve("projects", "second-miss")).resolves.toEqual({
      kind: "missing",
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("waits on the load a stale miss starts: a slug published since answers at once", async () => {
    const published: SlugLists = {
      ...SLUGS,
      published: { ...SLUGS.published, projects: ["portfolio", "fresh"] },
    };
    let loads = 0;
    const { registry, advance } = setup(() => {
      loads += 1;
      return ok(loads === 1 ? SLUGS : published);
    });
    await registry.resolve("projects", "portfolio");
    advance(61_000);

    expect(await registry.resolve("projects", "fresh")).toEqual({
      kind: "published",
    });
  });
});
