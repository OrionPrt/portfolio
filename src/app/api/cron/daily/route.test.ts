import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DB_UNAVAILABLE } from "@/db/query";
import type * as Purge from "@/features/retention/purge-repository";
import { err } from "@/lib/result";

const mocks = vi.hoisted(() => ({
  purgeExpired: vi.fn(),
  withDatabase: vi.fn(),
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/db/client", () => ({ withDatabase: mocks.withDatabase }));
vi.mock("@/lib/logger", () => ({ logger: mocks.log }));
vi.mock("@/features/retention/purge-repository", async (importOriginal) => ({
  ...(await importOriginal<typeof Purge>()),
  purgeExpired: mocks.purgeExpired,
}));

import { GET } from "./route";

const SECRET = "a-cron-secret-long-enough-for-the-schema-0123456789";

function call(authorization?: string): Promise<Response> {
  return GET(
    new Request("https://orion.dev/api/cron/daily", {
      headers:
        authorization === undefined ? {} : { authorization: authorization },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", SECRET);
  mocks.withDatabase.mockImplementation(
    (run: (db: unknown) => Promise<unknown>) => run({}),
  );
  mocks.purgeExpired.mockResolvedValue({
    messages: 2,
    sessions: 1,
    throttles: 0,
    auditLogs: 0,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/cron/daily", () => {
  it.each(["", "too-short"])(
    "refuses every call while no usable secret is set, as a wrong token, and says why in the logs",
    async (secret) => {
      vi.stubEnv("CRON_SECRET", secret);

      const response = await call(`Bearer ${secret}`);

      expect(response.status).toBe(401);
      expect(mocks.log.error).toHaveBeenCalledWith("cron.not_configured", {
        variable: "CRON_SECRET",
      });
      expect(mocks.purgeExpired).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, "Bearer wrong", SECRET])(
    "refuses the authorization %j, purging nothing",
    async (authorization) => {
      const response = await call(authorization);

      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(mocks.purgeExpired).not.toHaveBeenCalled();
    },
  );

  it("purges, logs and reports what went", async () => {
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      purged: { messages: 2, sessions: 1, throttles: 0, auditLogs: 0 },
    });
    expect(mocks.log.info).toHaveBeenCalledWith("cron.purged", {
      purged: "messages=2 sessions=1 throttles=0 auditLogs=0",
    });
  });

  it("fails the run when one purge failed, the others done", async () => {
    mocks.purgeExpired.mockResolvedValue({
      messages: 2,
      sessions: undefined,
      throttles: 0,
      auditLogs: 0,
    });

    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      purged: { messages: 2, sessions: null, throttles: 0, auditLogs: 0 },
    });
  });

  it("answers 503 when the database cannot be reached", async () => {
    mocks.withDatabase.mockResolvedValue(err(DB_UNAVAILABLE));

    expect((await call(`Bearer ${SECRET}`)).status).toBe(503);
  });
});
