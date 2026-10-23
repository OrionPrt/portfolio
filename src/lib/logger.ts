import "server-only";

import { type LOG_LEVELS, parseServerEnv } from "./env";
import { redactRecord } from "./redact";

export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogContext = Readonly<Record<string, unknown>>;

export interface LogRecord {
  readonly level: LogLevel;
  /** Dotted `domain.action` name, e.g. `auth.login_failed`. */
  readonly event: string;
  readonly time: string;
  readonly context: LogContext;
}

export type LogSink = (record: LogRecord) => void;

export interface Logger {
  debug(event: string, context?: LogContext): void;
  info(event: string, context?: LogContext): void;
  warn(event: string, context?: LogContext): void;
  error(event: string, context?: LogContext): void;
  child(bindings: LogContext): Logger;
}

interface LoggerOptions {
  readonly level: LogLevel;
  readonly sink?: LogSink;
  readonly now?: () => Date;
  readonly bindings?: LogContext;
}

const LEVEL_WEIGHT: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** One JSON line per record, through the console method matching its level (Vercel maps it to severity). */
export const consoleSink: LogSink = (record) => {
  console[record.level](JSON.stringify(record));
};

/** Logging must never break its caller: a throwing getter or proxy only costs the context. */
function safeContext(bindings: LogContext, context: LogContext): LogContext {
  try {
    return redactRecord({ ...bindings, ...context });
  } catch (error) {
    // The name only: the message could carry the very data redaction failed to clean.
    return {
      loggerError: error instanceof Error ? error.name : "UnknownError",
    };
  }
}

export function createLogger({
  level,
  sink = consoleSink,
  now = () => new Date(),
  bindings = {},
}: LoggerOptions): Logger {
  const emitter =
    (recordLevel: LogLevel) =>
    (event: string, context: LogContext = {}): void => {
      if (LEVEL_WEIGHT[recordLevel] < LEVEL_WEIGHT[level]) {
        return;
      }
      sink({
        level: recordLevel,
        event,
        time: now().toISOString(),
        context: safeContext(bindings, context),
      });
    };

  return {
    debug: emitter("debug"),
    info: emitter("info"),
    warn: emitter("warn"),
    error: emitter("error"),
    child: (childBindings) =>
      createLogger({
        level,
        sink,
        now,
        bindings: { ...bindings, ...childBindings },
      }),
  };
}

export const logger: Logger = createLogger({
  level: parseServerEnv(process.env).LOG_LEVEL,
});
