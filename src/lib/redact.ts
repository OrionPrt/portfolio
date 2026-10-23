export const REDACTED = "[REDACTED]";

/** Bounds the work of every scrubber below, and the size of a log line. */
export const MAX_STRING_LENGTH = 4096;
export const MAX_ARRAY_ITEMS = 50;

const CIRCULAR = "[Circular]";
const TRUNCATED = "[Truncated]";
const INVALID_DATE = "[Invalid Date]";
const MAX_DEPTH = 8;
const MAX_KEY_LENGTH = 128;

// A key is sensitive when its compact form (lower-case, separators removed) contains one
// of these stems, so plurals and prefixes match too ("cookies", "DBPassword", "access_key").
const SENSITIVE_KEY_STEMS: readonly string[] = [
  "accesskey",
  "apikey",
  "authorization",
  "bearer",
  "connectionstring",
  "cookie",
  "credential",
  "csrf",
  "databaseurl",
  "jwt",
  "otpauth",
  "passcode",
  "passphrase",
  "passwd",
  "password",
  "privatekey",
  "recovery",
  "secret",
  "session",
  "signature",
  "token",
  "totp",
  "xsrf",
];
// Short or ambiguous names only match as whole words: "otp" must not catch "footprint",
// "auth" must not catch "author", "pass" must not catch "passengers".
const SENSITIVE_KEY_WORDS: ReadonlySet<string> = new Set([
  "auth",
  "dsn",
  "otp",
  "pass",
  "pin",
  "pw",
  "pwd",
  "salt",
  "sid",
]);

// Every pattern is anchored on a literal or a run start, with bounded repetitions: linear time.
const VALUE_SCRUBBERS: readonly (readonly [
  pattern: RegExp,
  replacement: string,
])[] = [
  // Credentials in URLs: postgres://user:password@host, https://user@host
  [/\b([a-z][a-z0-9+.-]{0,31}:\/\/)[^\s/?#@]{1,256}@/gi, `$1${REDACTED}@`],
  // Authorization header values
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{1,4096}/gi, `$1 ${REDACTED}`],
  // JSON Web Tokens
  [
    /\beyJ[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{0,4096}/g,
    REDACTED,
  ],
  // Secrets in query strings and key=value text
  [
    /\b(access_token|api_?key|code|key|password|refresh_token|secret|sig|signature|token)=[^&\s"',;]{1,2048}/gi,
    `$1=${REDACTED}`,
  ],
  // Emails: keep the first character and the domain. The lookbehind only starts a match at
  // the beginning of a run, which keeps long runs without "@" linear.
  [
    /(?<![A-Za-z0-9._%+-])([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{0,63}@([A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,63})/g,
    "$1***@$2",
  ],
];

type Entry = readonly [key: string, value: unknown];

function keyWords(key: string): string[] {
  return key
    .slice(0, MAX_KEY_LENGTH)
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function isSensitiveKey(key: string): boolean {
  const words = keyWords(key);
  const compact = words.join("");
  return (
    SENSITIVE_KEY_STEMS.some((stem) => compact.includes(stem)) ||
    words.some(
      (word) =>
        SENSITIVE_KEY_WORDS.has(word) ||
        SENSITIVE_KEY_WORDS.has(word.replace(/s$/, "")),
    )
  );
}

/** Truncates `text`, then removes credentials, tokens and email local parts from it. */
export function scrubSecrets(text: string): string {
  const overflow = text.length - MAX_STRING_LENGTH;
  const bounded =
    overflow > 0
      ? `${text.slice(0, MAX_STRING_LENGTH)}…[+${overflow} chars]`
      : text;
  return VALUE_SCRUBBERS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    bounded,
  );
}

/**
 * Returns a JSON-safe deep copy of `value` with secrets removed, ready to be
 * logged or audited. Never mutates its input.
 */
export function redact(value: unknown): unknown {
  return redactValue(value, [], 0);
}

export function redactRecord(
  record: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return redactEntries(Object.entries(record), [record], 0);
}

function redactValue(
  value: unknown,
  ancestors: readonly object[],
  depth: number,
): unknown {
  if (typeof value === "string") return scrubSecrets(value);
  if (typeof value === "bigint") return value.toString();
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? INVALID_DATE : value.toISOString();
  }
  if (value instanceof URL) return scrubSecrets(value.href);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return `[Binary ${value.byteLength} bytes]`;
  }
  if (ancestors.includes(value)) return CIRCULAR;
  if (depth >= MAX_DEPTH) return TRUNCATED;

  const path = [...ancestors, value];
  if (value instanceof Error)
    return redactEntries(errorEntries(value), path, depth);
  if (value instanceof Map || value instanceof Headers) {
    return redactEntries(entriesOf(value), path, depth);
  }
  if (value instanceof Set || Array.isArray(value)) {
    return redactItems([...(value as Iterable<unknown>)], path, depth);
  }
  return redactEntries(Object.entries(value), path, depth);
}

function redactEntries(
  entries: readonly Entry[],
  ancestors: readonly object[],
  depth: number,
): Record<string, unknown> {
  return Object.fromEntries(
    entries.map(([key, value]) => [
      key,
      isSensitiveKey(key) ? REDACTED : redactValue(value, ancestors, depth + 1),
    ]),
  );
}

function redactItems(
  items: readonly unknown[],
  ancestors: readonly object[],
  depth: number,
): unknown[] {
  const kept = items
    .slice(0, MAX_ARRAY_ITEMS)
    .map((item) => redactValue(item, ancestors, depth + 1));
  const overflow = items.length - MAX_ARRAY_ITEMS;
  return overflow > 0 ? [...kept, `[+${overflow} items]`] : kept;
}

function entriesOf(
  collection: ReadonlyMap<unknown, unknown> | Headers,
): Entry[] {
  return [...collection.entries()].map(([key, value]) => [String(key), value]);
}

function errorEntries(error: Error): Entry[] {
  const entries: Entry[] = [
    ["name", error.name],
    ["message", error.message],
    ["stack", error.stack],
    // Own enumerable fields carry the diagnostics (`code`, `status`…).
    ...Object.entries(error).filter(([key]) => key !== "cause"),
  ];
  return error.cause === undefined
    ? entries
    : [...entries, ["cause", error.cause]];
}
