import { z } from "zod";

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

/** `VAR=` in an env file yields "": treat it as unset rather than invalid. */
function emptyAsUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

/**
 * Neon re-parses the connection string as an http URL, and on failure quotes it
 * whole, password included, in its error. Refusing such a value here keeps it
 * out of any error message.
 */
function isNeonParsable(value: string): boolean {
  return URL.canParse(`http:${value.slice(value.indexOf(":") + 1)}`);
}

/** 32 bytes in standard base64, as `openssl rand -base64 32` prints them. */
function isBase64Key(value: string): boolean {
  return (
    /^[A-Za-z0-9+/]{43}=$/.test(value) &&
    Buffer.from(value, "base64").length === 32
  );
}

function optionalText() {
  return z.preprocess(emptyAsUndefined, z.string().max(1000).optional());
}

/** A Postgres connection string, optional; never quoted whole in an error. */
function optionalDatabaseUrl() {
  return z.preprocess(
    emptyAsUndefined,
    z
      .url({ protocol: /^postgres(ql)?$/ })
      .refine(
        isNeonParsable,
        "must be a connection string the Neon driver can read",
      )
      .optional(),
  );
}

function optionalHttpsUrl() {
  return z.preprocess(
    emptyAsUndefined,
    z.url({ protocol: /^https$/ }).optional(),
  );
}

const serverSchema = z
  .object({
    NODE_ENV: z.preprocess(
      emptyAsUndefined,
      z.enum(["development", "test", "production"]).default("development"),
    ),
    VERCEL_ENV: z.preprocess(
      emptyAsUndefined,
      z.enum(["development", "preview", "production"]).optional(),
    ),
    LOG_LEVEL: z.preprocess(
      emptyAsUndefined,
      z.enum(LOG_LEVELS).default("info"),
    ),
    /** "true" lets a production build run on development secrets: the E2E server only. */
    ALLOW_DEVELOPMENT_SECRETS: z.preprocess(
      emptyAsUndefined,
      z.enum(["true", "false"]).optional(),
    ),
    // Contact form (P4). All optional: without them, development runs on
    // Cloudflare's test keys and in-memory limits, and production disables the
    // form (src/features/contact/config.ts).
    TURNSTILE_SITE_KEY: optionalText(),
    TURNSTILE_SECRET_KEY: optionalText(),
    /** Keys the HMAC that replaces stored IP addresses. */
    IP_HASH_SALT: z.preprocess(
      emptyAsUndefined,
      z.string().min(32, "must be at least 32 characters").optional(),
    ),
    UPSTASH_REDIS_REST_URL: optionalHttpsUrl(),
    UPSTASH_REDIS_REST_TOKEN: optionalText(),
    // The same, as named by Vercel's Upstash integration.
    KV_REST_API_URL: optionalHttpsUrl(),
    KV_REST_API_TOKEN: optionalText(),
    RESEND_API_KEY: optionalText(),
    CONTACT_TO_EMAIL: z.preprocess(emptyAsUndefined, z.email().optional()),
    /** "Name <address>"; without a verified domain, Resend only sends from onboarding@resend.dev. */
    CONTACT_FROM_EMAIL: optionalText(),
    // Admin (P5): seals the TOTP secret (AES-256-GCM), 32 bytes in base64.
    TOTP_ENCRYPTION_KEY: z.preprocess(
      emptyAsUndefined,
      z.string().refine(isBase64Key, "must be 32 bytes in base64").optional(),
    ),
    // Media (P6c): set by Vercel's Blob integration. Without it, development and
    // E2E store images on the local disk, and production refuses uploads.
    BLOB_READ_WRITE_TOKEN: optionalText(),
    // Set by Vercel: the production domain, a bare host. Base of canonical URLs
    // when NEXT_PUBLIC_SITE_URL is not set.
    VERCEL_PROJECT_PRODUCTION_URL: z.preprocess(
      emptyAsUndefined,
      z
        .string()
        .regex(/^[a-z0-9.-]+(:\d+)?$/, "must be a bare host name")
        .optional(),
    ),
    // The site's role (data changes only, ADR-0004). Without it, withDatabase()
    // logs the gap and reads fail as DB_UNAVAILABLE.
    DATABASE_URL: optionalDatabaseUrl(),
    // The owner's, for migrations, the seed and the roles script only; they fall
    // back on DATABASE_URL (a local database with one user). Never on Vercel.
    DATABASE_OWNER_URL: optionalDatabaseUrl(),
  })
  // Production and previews only: `vercel env pull` writes "development"
  // into a developer's .env.local, where the owner's URL belongs.
  .refine(
    ({ VERCEL_ENV, DATABASE_OWNER_URL }) =>
      (VERCEL_ENV !== "production" && VERCEL_ENV !== "preview") ||
      DATABASE_OWNER_URL === undefined,
    {
      path: ["DATABASE_OWNER_URL"],
      message: "must not be set on Vercel: the site connects as its own role",
    },
  );

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
