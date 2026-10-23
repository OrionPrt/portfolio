import { describe, expect, it, vi } from "vitest";

import { fetchWithTimeout } from "./fetch-timeout";

/** A fetch that only settles when its signal aborts. */
function hangingFetch() {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(init.signal?.reason as Error);
        });
      }),
  );
}

describe("fetchWithTimeout", () => {
  it("aborts a request that outlives the timeout", async () => {
    const fetchWithin = fetchWithTimeout(hangingFetch(), 10);

    await expect(fetchWithin("https://db.example/sql")).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });

  it("gives every request a timeout of its own", async () => {
    const inner = vi.fn(() => Promise.resolve(new Response("ok")));
    const fetchWithin = fetchWithTimeout(inner, 1000);

    await fetchWithin("https://db.example/sql", { method: "POST" });
    await fetchWithin("https://db.example/sql");

    const [first, second] = inner.mock.calls.map(
      (call) => (call as unknown[])[1] as RequestInit,
    );
    expect(first?.method).toBe("POST");
    expect(first?.signal).toBeInstanceOf(AbortSignal);
    expect(first?.signal).not.toBe(second?.signal);
  });

  it("still honours the caller's own signal", async () => {
    const controller = new AbortController();
    const fetchWithin = fetchWithTimeout(hangingFetch(), 60_000);

    const pending = fetchWithin("https://db.example/sql", {
      signal: controller.signal,
    });
    controller.abort(new Error("cancelled"));

    await expect(pending).rejects.toThrow("cancelled");
  });
});
