import { describe, expect, it } from "vitest";

import { siteUrl } from "./site-url";

describe("siteUrl", () => {
  it("prefers the configured public origin", () => {
    expect(
      siteUrl({
        NEXT_PUBLIC_SITE_URL: "https://orion.dev",
        VERCEL_PROJECT_PRODUCTION_URL: "portfolio.vercel.app",
      }).href,
    ).toBe("https://orion.dev/");
  });

  it("falls back to the Vercel production domain, over https", () => {
    expect(
      siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "portfolio.vercel.app" }).href,
    ).toBe("https://portfolio.vercel.app/");
  });

  it("falls back to the local server in development", () => {
    expect(siteUrl({}).href).toBe("http://localhost:3000/");
  });

  it("refuses a production domain that is not a bare host", () => {
    expect(() =>
      siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "evil.example/path?x=1" }),
    ).toThrow();
  });
});
