import { describe, expect, it } from "vitest";

import { CONTACT_LIMITS } from "./fields";
import { parseContactInput } from "./schema";

const VALID = {
  name: "  Ada Lovelace ",
  email: " ada@example.com ",
  subject: "Une mission",
  message: "Bonjour, j'ai un projet à vous proposer.",
};

describe("parseContactInput", () => {
  it("accepts a complete message, trimmed", () => {
    expect(parseContactInput(VALID)).toEqual({
      ok: true,
      data: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        subject: "Une mission",
        message: "Bonjour, j'ai un projet à vous proposer.",
      },
    });
  });

  it("names every missing field", () => {
    expect(parseContactInput({ name: "  ", subject: null })).toEqual({
      ok: false,
      error: {
        name: "required",
        email: "required",
        subject: "required",
        message: "required",
      },
    });
  });

  it.each([
    ["name", "a".repeat(CONTACT_LIMITS.name + 1), "too_long"],
    ["subject", "a".repeat(CONTACT_LIMITS.subject + 1), "too_long"],
    ["message", "a".repeat(CONTACT_LIMITS.message + 1), "too_long"],
    ["message", "Bonjour", "too_short"],
    ["email", "not-an-email", "invalid"],
    ["email", `${"a".repeat(250)}@example.com`, "too_long"],
    // One-line fields: a line break could forge a header downstream.
    ["name", "Ada\r\nBcc: victim@example.com", "invalid"],
    ["subject", "Hello\nWorld", "invalid"],
    // Control characters: Postgres refuses NUL, the others spoof what is shown.
    ["name", "Ada\u0000", "invalid"],
    ["name", "Ada\u2028Lovelace", "invalid"],
    ["subject", "Facture \u202Efdp.exe", "invalid"],
    ["message", "Bonjour, un projet\u0000.", "invalid"],
    ["message", "Bonjour, un projet\u0007.", "invalid"],
  ])("rejects the %s %j as %s", (field, value, code) => {
    const result = parseContactInput({ ...VALID, [field]: value });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toEqual({ [field]: code });
  });

  it("keeps a message's line breaks and tabs, as the browser counts them", () => {
    // Forms send line breaks as CRLF; the browser's maxLength counts one character.
    const message = "Bonjour,\r\n\tj'ai un projet.\r\nÀ bientôt";

    expect(parseContactInput({ ...VALID, message })).toMatchObject({
      ok: true,
      data: { message: "Bonjour,\n\tj'ai un projet.\nÀ bientôt" },
    });
  });

  it("accepts a message at the limit, line breaks included", () => {
    const line = `${"a".repeat(49)}\r\n`;
    const message = line.repeat(CONTACT_LIMITS.message / 50);

    expect(parseContactInput({ ...VALID, message }).ok).toBe(true);
  });

  it("ignores fields it does not know", () => {
    expect(parseContactInput({ ...VALID, admin: "true" })).toMatchObject({
      ok: true,
      data: { name: "Ada Lovelace" },
    });
  });
});
