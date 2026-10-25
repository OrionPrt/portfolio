import { describe, expect, it } from "vitest";

import { readBodyWithLimit } from "./read-body";

function request(body: string | undefined, headers: HeadersInit = {}) {
  return new Request("https://orion.dev/api", {
    method: "POST",
    body,
    headers,
  });
}

describe("readBodyWithLimit", () => {
  it("reads a body within the limit", async () => {
    expect(await readBodyWithLimit(request("hello"), 10)).toBe("hello");
  });

  it("refuses a body over the limit, counted in bytes", async () => {
    expect(await readBodyWithLimit(request("é".repeat(6)), 10)).toBeUndefined();
  });

  it("refuses at once a body announced as too large", async () => {
    expect(
      await readBodyWithLimit(request("x", { "content-length": "1000" }), 10),
    ).toBeUndefined();
  });

  it("reads an empty body as empty text", async () => {
    expect(await readBodyWithLimit(request(undefined), 10)).toBe("");
  });
});
