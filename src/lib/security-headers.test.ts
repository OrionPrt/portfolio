import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";
import { CSP_REPORT_GROUP, CSP_REPORT_PATH } from "./csp";
import { SECURITY_HEADERS } from "./security-headers";

const ONE_YEAR_IN_SECONDS = 31_536_000;

const headers = new Map(
  SECURITY_HEADERS.map(({ key, value }) => [key.toLowerCase(), value]),
);

describe("SECURITY_HEADERS", () => {
  it("enforces HTTPS for at least a year, subdomains included", () => {
    const hsts = headers.get("strict-transport-security") ?? "";
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1]);

    expect(maxAge).toBeGreaterThanOrEqual(ONE_YEAR_IN_SECONDS);
    expect(hsts).toContain("includeSubDomains");
  });

  it("blocks MIME sniffing and framing by other sites", () => {
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("x-frame-options")).toBe("DENY");
  });

  it("only sends the origin to other sites", () => {
    expect(headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("isolates the browsing context and resources from other origins", () => {
    expect(headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(headers.get("cross-origin-resource-policy")).toBe("same-origin");
  });

  it("disables powerful browser features the site never uses", () => {
    const policy = headers.get("permissions-policy") ?? "";

    for (const feature of [
      "camera",
      "microphone",
      "geolocation",
      "payment",
      "usb",
    ]) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  it("names the endpoint that receives CSP violation reports", () => {
    expect(headers.get("reporting-endpoints")).toBe(
      `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`,
    );
  });

  it("declares each header only once", () => {
    expect(headers.size).toBe(SECURITY_HEADERS.length);
  });
});

describe("next.config", () => {
  it.each(["/", "/fr/projets/demo", "/api/cron/daily"])(
    "applies every security header to %s",
    async (path) => {
      const response = await unstable_getResponseFromNextConfig({
        url: `https://portfolio.test${path}`,
        nextConfig,
      });

      for (const { key, value } of SECURITY_HEADERS) {
        expect(response.headers.get(key)).toBe(value);
      }
    },
  );

  it("does not advertise the framework in an X-Powered-By header", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
