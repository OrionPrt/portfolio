import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { openSecret, parseSealingKey, sealSecret } from "./secret-box";

const KEY = new Uint8Array(randomBytes(32));
const SECRET = new TextEncoder().encode("12345678901234567890");
const USER = "6f1c4c1e-3c6a-4f0e-9d0b-1f6c2b9a7e10";

/** Changes one base64url character of a part of the sealed value. */
function tamper(sealed: string, part: number): string {
  const parts = sealed.split(".");
  const value = parts[part] ?? "";
  const flipped = value.startsWith("A")
    ? `B${value.slice(1)}`
    : `A${value.slice(1)}`;
  return parts
    .map((current, index) => (index === part ? flipped : current))
    .join(".");
}

describe("sealSecret / openSecret", () => {
  it("opens what it sealed, for the same account", () => {
    const sealed = sealSecret(SECRET, KEY, USER);

    expect(openSecret(sealed, KEY, USER)).toEqual({ ok: true, data: SECRET });
  });

  it("seals in the format the database accepts, never twice the same", () => {
    const sealed = sealSecret(SECRET, KEY, USER);

    expect(sealed).toMatch(
      /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    );
    expect(sealSecret(SECRET, KEY, USER)).not.toBe(sealed);
    expect(sealed).not.toContain(Buffer.from(SECRET).toString("base64url"));
  });

  it.each([
    ["another account", (sealed: string) => openSecret(sealed, KEY, "other")],
    [
      "another key",
      (sealed: string) =>
        openSecret(sealed, new Uint8Array(randomBytes(32)), USER),
    ],
    [
      "a changed nonce",
      (sealed: string) => openSecret(tamper(sealed, 1), KEY, USER),
    ],
    [
      "a changed ciphertext",
      (sealed: string) => openSecret(tamper(sealed, 2), KEY, USER),
    ],
    [
      "a changed tag",
      (sealed: string) => openSecret(tamper(sealed, 3), KEY, USER),
    ],
    [
      "an unknown version",
      (sealed: string) => openSecret(sealed.replace(/^v1/, "v2"), KEY, USER),
    ],
    ["a malformed value", () => openSecret("v1.abc", KEY, USER)],
  ])("refuses %s", (_label, open) => {
    expect(open(sealSecret(SECRET, KEY, USER))).toMatchObject({ ok: false });
  });
});

describe("parseSealingKey", () => {
  it("reads a 256-bit key from base64", () => {
    const encoded = Buffer.from(KEY).toString("base64");

    expect(parseSealingKey(encoded)).toEqual({ ok: true, data: KEY });
  });

  it.each(["", "c2hvcnQ=", Buffer.alloc(31).toString("base64"), "not base64!"])(
    "refuses %j",
    (encoded) => {
      expect(parseSealingKey(encoded)).toMatchObject({ ok: false });
    },
  );
});
