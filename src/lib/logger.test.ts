import { afterEach, describe, expect, it, vi } from "vitest";

import { createLogger, type LogLevel, type LogRecord } from "./logger";
import { REDACTED } from "./redact";

const FIXED_TIME = new Date("2026-01-01T00:00:00.000Z");
const LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

function createTestLogger(level: LogLevel = "debug") {
  const records: LogRecord[] = [];
  const logger = createLogger({
    level,
    sink: (record) => {
      records.push(record);
    },
    now: () => FIXED_TIME,
  });
  return { logger, records };
}

describe("createLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits a structured record with level, event, time and context", () => {
    const { logger, records } = createTestLogger();

    logger.info("contact.message_received", { locale: "fr" });

    expect(records).toEqual([
      {
        level: "info",
        event: "contact.message_received",
        time: "2026-01-01T00:00:00.000Z",
        context: { locale: "fr" },
      },
    ]);
  });

  it("drops records below the configured level", () => {
    const { logger, records } = createTestLogger("warn");

    logger.debug("debug.event");
    logger.info("info.event");
    logger.warn("warn.event");
    logger.error("error.event");

    expect(records.map((record) => record.event)).toEqual([
      "warn.event",
      "error.event",
    ]);
  });

  it("redacts secrets and masks emails before records reach the sink", () => {
    const { logger, records } = createTestLogger();

    logger.warn("auth.login_failed", {
      email: "jane.doe@example.com",
      password: "hunter2",
      totp: "123456",
    });

    expect(records[0]?.context).toEqual({
      email: "j***@example.com",
      password: REDACTED,
      totp: REDACTED,
    });
  });

  it("binds context in child loggers without altering the parent", () => {
    const { logger, records } = createTestLogger();
    const child = logger.child({ requestId: "req-1" });

    child.info("request.started", { path: "/fr" });
    logger.info("app.ready");

    expect(records.map((record) => record.context)).toEqual([
      { requestId: "req-1", path: "/fr" },
      {},
    ]);
  });

  it("redacts the bindings of child loggers too", () => {
    const { logger, records } = createTestLogger();

    logger.child({ sessionToken: "abc" }).info("request.started");

    expect(records[0]?.context).toEqual({ sessionToken: REDACTED });
  });

  it("never throws, even when the context cannot be read", () => {
    const { logger, records } = createTestLogger();
    const hostile = Object.defineProperty({}, "boom", {
      enumerable: true,
      get: () => {
        throw new Error("getter exploded");
      },
    });

    expect(() => {
      logger.error("db.query_failed", hostile);
    }).not.toThrow();
    expect(records[0]?.context).toEqual({ loggerError: "Error" });
  });

  it.each(LEVELS)(
    "writes %s records as JSON lines through the matching console method",
    (level) => {
      const consoleMethod = vi
        .spyOn(console, level)
        .mockImplementation(() => undefined);
      const logger = createLogger({ level: "debug", now: () => FIXED_TIME });

      logger[level]("db.query_failed", { table: "projects" });

      expect(consoleMethod).toHaveBeenCalledOnce();
      expect(JSON.parse(String(consoleMethod.mock.calls[0]?.[0]))).toEqual({
        level,
        event: "db.query_failed",
        time: "2026-01-01T00:00:00.000Z",
        context: { table: "projects" },
      });
    },
  );
});
