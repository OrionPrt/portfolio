import { afterEach, describe, expect, it, vi } from "vitest";

const upstash = vi.hoisted(() => ({
  limit:
    vi.fn<(key: string) => Promise<{ success: boolean; reason?: string }>>(),
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }
    limit = upstash.limit;
  },
}));
vi.mock("@upstash/redis", () => ({
  Redis: class {
    readonly stub = true;
  },
}));

import { CONTACT_RATE_LIMIT, createContactRateLimiter } from "./rate-limit";

describe("createContactRateLimiter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows a few messages an hour per sender in memory", async () => {
    const limiter = createContactRateLimiter(undefined);
    const answers: boolean[] = [];

    for (let attempt = 0; attempt <= CONTACT_RATE_LIMIT.limit; attempt++) {
      answers.push(await limiter.allow("sender"));
    }

    expect(answers.filter(Boolean)).toHaveLength(CONTACT_RATE_LIMIT.limit);
    expect(answers.at(-1)).toBe(false);
    expect(await limiter.allow("someone-else")).toBe(true);
  });

  it("caps messages overall, whoever sends them, and says so in the logs", async () => {
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const limiter = createContactRateLimiter(undefined);

    for (let sender = 0; sender < CONTACT_RATE_LIMIT.overall; sender++) {
      expect(await limiter.allow(`sender-${String(sender)}`)).toBe(true);
    }

    expect(await limiter.allow("one-more")).toBe(false);
    expect(String(consoleWarn.mock.calls[0]?.[0])).toContain(
      "contact.overall_limit_reached",
    );
  });

  it("asks Upstash when it is configured", async () => {
    upstash.limit.mockResolvedValueOnce({ success: false });
    const limiter = createContactRateLimiter({
      url: "https://x.upstash.io",
      token: "t",
    });

    expect(await limiter.allow("sender")).toBe(false);
    expect(upstash.limit).toHaveBeenCalledWith("sender");
  });

  it("checks the overall cap in Upstash once the sender is within theirs", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    upstash.limit
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false });
    const limiter = createContactRateLimiter({
      url: "https://x.upstash.io",
      token: "t",
    });

    expect(await limiter.allow("sender")).toBe(false);
    expect(upstash.limit.mock.calls).toEqual([["sender"], ["all"]]);
  });

  it("lets a message through, logged, when Upstash times out", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    upstash.limit.mockResolvedValue({ success: true, reason: "timeout" });
    const limiter = createContactRateLimiter({
      url: "https://x.upstash.io",
      token: "t",
    });

    expect(await limiter.allow("sender")).toBe(true);
    expect(String(consoleError.mock.calls[0]?.[0])).toContain(
      "contact.rate_limit_unavailable",
    );
  });

  it("lets a message through, logged, when Upstash fails: Turnstile still guards", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    upstash.limit.mockRejectedValueOnce(new Error("unreachable"));
    const limiter = createContactRateLimiter({
      url: "https://x.upstash.io",
      token: "t",
    });

    expect(await limiter.allow("sender")).toBe(true);
    expect(String(consoleError.mock.calls[0]?.[0])).toContain(
      "contact.rate_limit_unavailable",
    );
  });
});
