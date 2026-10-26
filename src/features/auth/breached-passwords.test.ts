import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { isBreachedPassword } from "./breached-passwords";

const PASSWORD = "password123";
const SHA1 = createHash("sha1").update(PASSWORD).digest("hex").toUpperCase();
const PREFIX = SHA1.slice(0, 5);
const SUFFIX = SHA1.slice(5);

function answering(body: string, status = 200) {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response(body, { status })),
  );
}

describe("isBreachedPassword", () => {
  it("sends only the first 5 characters of the SHA-1 (k-anonymity)", async () => {
    const fetchImpl = answering("");

    await isBreachedPassword(PASSWORD, fetchImpl);

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${PREFIX}`);
    expect(new Headers(init?.headers).get("Add-Padding")).toBe("true");
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain(SUFFIX);
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain(PASSWORD);
  });

  it("finds a password in the breached list", async () => {
    const fetchImpl = answering(
      `0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${SUFFIX}:2413945\r\n`,
    );

    expect(await isBreachedPassword(PASSWORD, fetchImpl)).toEqual({
      ok: true,
      data: true,
    });
  });

  it("ignores the padding entries, which have a count of 0", async () => {
    const fetchImpl = answering(`${SUFFIX}:0\r\nFFFFF${SUFFIX.slice(5)}:3`);

    expect(await isBreachedPassword(PASSWORD, fetchImpl)).toEqual({
      ok: true,
      data: false,
    });
  });

  it.each([
    ["an error status", () => answering("", 503)],
    [
      "a network failure",
      () => vi.fn<typeof fetch>(() => Promise.reject(new Error("offline"))),
    ],
  ])("reports the service as unavailable on %s", async (_label, fetchImpl) => {
    expect(await isBreachedPassword(PASSWORD, fetchImpl())).toEqual({
      ok: false,
      error: "unavailable",
    });
  });
});
