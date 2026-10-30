import { describe, expect, it } from "vitest";

import { cronSecretOf, isCronRequest } from "./cron-auth";

const SECRET = "a-cron-secret-long-enough-for-the-schema-0123456789";

describe("isCronRequest", () => {
  it.each([
    [`Bearer ${SECRET}`, true],
    [`Bearer ${SECRET} `, false],
    [`bearer ${SECRET}`, false],
    [SECRET, false],
    ["Bearer ", false],
    [null, false],
  ])("authorization %j → %s", (authorization, expected) => {
    expect(isCronRequest(authorization, SECRET)).toBe(expected);
  });
});

describe("cronSecretOf", () => {
  it("uses a secret of 32 characters or more, and nothing shorter", () => {
    expect(cronSecretOf({ CRON_SECRET: SECRET })).toBe(SECRET);
    expect(cronSecretOf({ CRON_SECRET: "short" })).toBeUndefined();
    expect(cronSecretOf({})).toBeUndefined();
  });
});
