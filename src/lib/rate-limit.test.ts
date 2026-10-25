import { describe, expect, it } from "vitest";

import { createRateLimiter } from "./rate-limit";

function setup(limit = 2, maxKeys = 100) {
  let time = 0;
  const limiter = createRateLimiter({
    limit,
    windowMs: 60_000,
    maxKeys,
    now: () => time,
  });
  return {
    limiter,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe("createRateLimiter", () => {
  it("allows a key up to the limit within a window, then refuses it", () => {
    const { limiter } = setup();

    expect([
      limiter.allow("a"),
      limiter.allow("a"),
      limiter.allow("a"),
    ]).toEqual([true, true, false]);
    expect(limiter.allow("b")).toBe(true);
  });

  it("opens again once the window has passed", () => {
    const { limiter, advance } = setup(1);
    limiter.allow("a");

    advance(60_000);

    expect(limiter.allow("a")).toBe(true);
  });

  it("never tracks more keys than allowed: new keys are refused while it is full", () => {
    const { limiter, advance } = setup(5, 2);
    limiter.allow("a");
    limiter.allow("b");

    expect(limiter.allow("c")).toBe(false);

    advance(60_000);
    expect(limiter.allow("c")).toBe(true);
  });
});
