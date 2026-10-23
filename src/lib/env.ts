import { z } from "zod";

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

/** `VAR=` in an env file yields "": treat it as unset rather than invalid. */
function emptyAsUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

const serverSchema = z.object({
  NODE_ENV: z.preprocess(
    emptyAsUndefined,
    z.enum(["development", "test", "production"]).default("development"),
  ),
  VERCEL_ENV: z.preprocess(
    emptyAsUndefined,
    z.enum(["development", "preview", "production"]).optional(),
  ),
  LOG_LEVEL: z.preprocess(emptyAsUndefined, z.enum(LOG_LEVELS).default("info")),
});

/** The value is inlined into the client bundle: scheme, host and port only, never credentials. */
function isBareOrigin(value: string): boolean {
  // Zod still runs refinements after a failed check: leave invalid URLs to z.url().
  if (!URL.canParse(value)) {
    return true;
  }
  const url = new URL(value);
  return (
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "" &&
    !value.includes("#")
  );
}

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.preprocess(
    emptyAsUndefined,
    z
      .url({ protocol: /^https?$/ })
      .refine(
        isBareOrigin,
        "must be a bare origin: scheme, host and optional port only",
      )
      .optional(),
  ),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;
type EnvScope = "server" | "client";
type EnvSource = Readonly<Record<string, string | undefined>>;

export class EnvValidationError extends Error {
  readonly issues: readonly string[];

  constructor(scope: EnvScope, issues: readonly string[]) {
    super(
      `Invalid ${scope} environment variables:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`,
    );
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

function parseWith<T>(
  schema: z.ZodType<T>,
  scope: EnvScope,
  source: EnvSource,
): T {
  const result = schema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  // Issues name the variable but never echo its value, which may be a secret.
  const issues = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  );
  throw new EnvValidationError(scope, issues);
}

export function parseServerEnv(source: EnvSource): ServerEnv {
  return parseWith(serverSchema, "server", source);
}

/**
 * Next.js only inlines `NEXT_PUBLIC_*` variables referenced literally, so
 * client code must pass `{ NEXT_PUBLIC_X: process.env.NEXT_PUBLIC_X }`.
 */
export function parseClientEnv(source: EnvSource): ClientEnv {
  return parseWith(clientSchema, "client", source);
}
