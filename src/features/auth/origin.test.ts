import { describe, expect, it } from "vitest";

import { isSameOriginRequest } from "./origin";

describe("isSameOriginRequest", () => {
  it.each([
    [{ origin: "https://orion.dev", host: "orion.dev" }, true],
    [{ origin: "http://localhost:3100", host: "localhost:3100" }, true],
    [
      {
        origin: "https://orion.dev",
        host: "internal",
        "x-forwarded-host": "orion.dev",
      },
      true,
    ],
    [
      {
        origin: "https://orion.dev",
        host: "orion.dev",
        "sec-fetch-site": "same-origin",
      },
      true,
    ],
    // Refused: another site, no origin at all, or the browser says cross-site.
    [{ origin: "https://evil.example", host: "orion.dev" }, false],
    [{ host: "orion.dev" }, false],
    [{ origin: "null", host: "orion.dev" }, false],
    [
      {
        origin: "https://orion.dev",
        host: "orion.dev",
        "sec-fetch-site": "cross-site",
      },
      false,
    ],
    [{ origin: "https://orion.dev.evil.example", host: "orion.dev" }, false],
  ])("judges %j as %s", (headers, expected) => {
    expect(isSameOriginRequest(new Headers(headers))).toBe(expected);
  });
});
