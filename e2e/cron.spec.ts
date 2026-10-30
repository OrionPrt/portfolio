import { expect, test } from "@playwright/test";

import { E2E_CRON_SECRET } from "./support/cron";

test.describe("daily cron", () => {
  test("refuses a call without the cron's token, purging nothing", async ({
    request,
  }) => {
    for (const authorization of [undefined, "Bearer wrong"]) {
      const response = await request.get("/api/cron/daily", {
        headers: authorization === undefined ? {} : { authorization },
      });

      expect(response.status()).toBe(401);
      expect(response.headers()["cache-control"]).toBe("no-store");
    }
  });

  test("purges with the token, and says what it removed", async ({
    request,
  }) => {
    test.skip(
      Boolean(process.env.E2E_BASE_URL),
      "A deployed site has its own token.",
    );

    const response = await request.get("/api/cron/daily", {
      headers: { authorization: `Bearer ${E2E_CRON_SECRET}` },
    });

    expect(response.status()).toBe(200);
    const { purged } = (await response.json()) as {
      purged: Record<string, unknown>;
    };
    expect(Object.keys(purged)).toEqual([
      "messages",
      "sessions",
      "throttles",
      "auditLogs",
    ]);
    for (const count of Object.values(purged)) {
      expect(typeof count).toBe("number");
    }
  });
});
