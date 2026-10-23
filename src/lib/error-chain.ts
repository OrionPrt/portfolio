import { scrubSecrets } from "./redact";

const MAX_DEPTH = 5;

/** What to print when an error carries no message (Node's WebSocket gives none). */
export const NO_DETAIL =
  "no detail given (check DATABASE_URL and that the database is reachable)";

function field(value: unknown, key: "message" | "cause" | "error"): unknown {
  return typeof value === "object" && value !== null && key in value
    ? (value as Record<typeof key, unknown>)[key]
    : undefined;
}

function messageOf(value: unknown): string {
  const message = typeof value === "string" ? value : field(value, "message");
  return typeof message === "string" && message !== "" ? message : NO_DETAIL;
}

/**
 * An error and its causes on one block of text, secrets scrubbed, for command
 * line output. Drizzle wraps the driver's error in `cause`, and a failed
 * WebSocket reports an event holding `error`: both are followed.
 */
export function describeErrorChain(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  // Bounded by depth, not by messages: a cause may point back to itself.
  for (let depth = 0; depth < MAX_DEPTH && current !== undefined; depth++) {
    const message = messageOf(current);
    if (messages.at(-1) !== message) {
      messages.push(message);
    }
    current = field(current, "cause") ?? field(current, "error");
  }
  // Driver messages can quote the connection string.
  return scrubSecrets(messages.join("\n  caused by: "));
}
