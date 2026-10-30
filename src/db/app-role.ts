import { randomBytes } from "node:crypto";

import { getTableName, sql, type SQL } from "drizzle-orm";

import { scrubSecrets } from "@/lib/redact";

import { rowsOf } from "./rows";
import { adminUsers, auditLogs } from "./schema";
import { APP_ROLE, QUERY_TIMEOUT_MS } from "./settings";
import type { Database } from "./types";

type DataRight = "update" | "delete";

/**
 * Rights taken back from the site on some tables: the audit log is only
 * added to, and the admin account is never deleted (that would clear the
 * log's actor through its foreign key).
 */
const WITHHELD: readonly {
  readonly table: string;
  readonly rights: readonly DataRight[];
}[] = [
  { table: getTableName(auditLogs), rights: ["update", "delete"] },
  { table: getTableName(adminUsers), rights: ["delete"] },
];

const ROLE = `"${APP_ROLE}"`;

/**
 * The audit log's only deletion: the entries over 12 months old, through a
 * function that runs with its owner's rights (migration 0007, ADR-0009).
 */
const AUDIT_PURGE = 'public."purge_audit_logs"()';

/** 256 bits, URL-safe: it goes in a connection string as it is. */
const PASSWORD_BYTES = 32;

/** Letters, digits, `-` and `_`: never needs quoting, in SQL or in a URL. */
const PASSWORD_FORMAT = /^[A-Za-z0-9_-]{24,128}$/;

export function generatePassword(): string {
  return randomBytes(PASSWORD_BYTES).toString("base64url");
}

export function isUsablePassword(password: string): boolean {
  return PASSWORD_FORMAT.test(password);
}

function qualified(table: string): string {
  return `public."${table}"`;
}

/**
 * Rights reset, then given: the role reaches the public schema's tables for
 * data only (no TRUNCATE, REFERENCES or TRIGGER), minus the rights withheld,
 * and gets the same data rights on the tables the owner creates later
 * (migrations). Of the functions, it may run the audit log's purge alone. No sequence: identity columns need none, so no id is burnt by
 * hand. The migrations' own schema stays closed. Its queries stop on the
 * server when the site's driver gives up on them.
 */
export function grantStatements(): readonly string[] {
  return [
    `revoke all on schema public from ${ROLE}`,
    `grant usage on schema public to ${ROLE}`,
    `revoke all on all tables in schema public from ${ROLE}`,
    `grant select, insert, update, delete on all tables in schema public to ${ROLE}`,
    ...WITHHELD.map(
      ({ table, rights }) =>
        `revoke ${rights.join(", ")} on ${qualified(table)} from ${ROLE}`,
    ),
    `revoke all on all functions in schema public from ${ROLE}`,
    // PostgreSQL lets everyone run a new function: not the owner's next ones.
    "alter default privileges revoke execute on functions from public",
    `grant execute on function ${AUDIT_PURGE} to ${ROLE}`,
    `revoke all on all sequences in schema public from ${ROLE}`,
    `alter default privileges in schema public revoke all on sequences from ${ROLE}`,
    `alter default privileges in schema public grant select, insert, update, delete on tables to ${ROLE}`,
    `alter role ${ROLE} set statement_timeout = ${String(QUERY_TIMEOUT_MS)}`,
  ];
}

interface RoleState {
  readonly rolsuper: boolean;
  readonly rolcreaterole: boolean;
  readonly rolcreatedb: boolean;
  readonly rolreplication: boolean;
  readonly rolbypassrls: boolean;
  readonly memberships: number;
}

async function roleState(db: Database): Promise<RoleState | undefined> {
  const result = await db.execute(sql`
    select rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls,
      (select count(*)::int from pg_auth_members where member = r.oid) as memberships
    from pg_roles r where rolname = ${APP_ROLE}`);
  const [row] = rowsOf(result) as readonly RoleState[];
  return row;
}

/**
 * Anything beyond data changes: an attribute this script never sets, or a
 * membership (Neon makes the roles created from its console members of
 * neon_superuser). Such a role is refused rather than used.
 */
function widerThanData(state: RoleState): boolean {
  return (
    state.rolsuper ||
    state.rolcreaterole ||
    state.rolcreatedb ||
    state.rolreplication ||
    state.rolbypassrls ||
    state.memberships > 0
  );
}

export interface AppRoleOptions {
  /** Chosen by the caller (the CI): set on every run. */
  readonly password?: string;
  /** A new password, generated, for a role that exists. */
  readonly rotate?: boolean;
}

export interface AppRoleOutcome {
  readonly created: boolean;
  /** Set when this run generated the password: shown once, never stored. */
  readonly generatedPassword: string | undefined;
}

function passwordFor(
  exists: boolean,
  { password, rotate = false }: AppRoleOptions,
): { readonly value: string | undefined; readonly isGenerated: boolean } {
  if (password !== undefined) {
    return { value: password, isGenerated: false };
  }
  return !exists || rotate
    ? { value: generatePassword(), isGenerated: true }
    : { value: undefined, isGenerated: false };
}

/** What a refused role must lose before the script will use it. */
const DROP_HINT = `DROP OWNED BY ${ROLE}; DROP ROLE ${ROLE};`;

/** The role's creation or change: on failure, its reason alone, never the statement. */
async function setLogin(
  db: Database,
  exists: boolean,
  password: string | undefined,
): Promise<void> {
  // Utility statements take no parameters: the password's format was checked.
  const login =
    password === undefined ? "login" : `login password '${password}'`;
  try {
    await db.execute(
      sql.raw(`${exists ? "alter" : "create"} role ${ROLE} ${login}`),
    );
  } catch (error) {
    const reason =
      error instanceof Error && error.cause instanceof Error
        ? error.cause
        : error;
    throw new Error(
      `Could not ${exists ? "update" : "create"} the role ${APP_ROLE}: ${scrubSecrets(reason instanceof Error ? reason.message : String(reason))}`,
    );
  }
}

/** Each right the role must not hold, and how to tell it does (owner's view). */
function excessChecks(): readonly (readonly [string, SQL])[] {
  const role = sql`${APP_ROLE}::name`;
  return [
    [
      "CREATE on schema public",
      sql`has_schema_privilege(${role}, 'public', 'CREATE')`,
    ],
    [
      "CREATE on the database",
      sql`has_database_privilege(${role}, current_database(), 'CREATE')`,
    ],
    [
      "TRUNCATE on a table",
      sql`exists (select from pg_tables t where t.schemaname = 'public'
        and has_table_privilege(${role}, format('%I.%I', t.schemaname, t.tablename), 'TRUNCATE'))`,
    ],
    [
      "EXECUTE on an owner's-rights function other than the audit purge",
      sql`exists (select from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef and p.proname <> 'purge_audit_logs'
        and has_function_privilege(${role}, p.oid, 'EXECUTE'))`,
    ],
    [
      "an object of its own",
      sql`exists (select from pg_class c join pg_roles r on r.oid = c.relowner where r.rolname = ${role})
        or exists (select from pg_namespace n join pg_roles r on r.oid = n.nspowner where r.rolname = ${role})`,
    ],
    ...WITHHELD.flatMap(({ table, rights }) =>
      rights.map(
        (right) =>
          [
            `${right.toUpperCase()} on ${table}`,
            sql`has_table_privilege(${role}, ${qualified(table)}::text, ${right}::text)`,
          ] as const,
      ),
    ),
  ];
}

/**
 * Rights the role still holds once its own were reset: granted to PUBLIC (a
 * database upgraded from before PostgreSQL 15 lets everyone create in the
 * public schema), or by another grantor. Only the owner can take them back.
 */
async function excessRights(db: Database): Promise<readonly string[]> {
  const checks = excessChecks();
  const result = await db.execute(
    sql`select ${sql.join(
      checks.map(
        ([, check], index) =>
          sql`(${check}) as ${sql.identifier(`c${String(index)}`)}`,
      ),
      sql`, `,
    )}`,
  );
  const [row] = rowsOf(result) as readonly Readonly<Record<string, unknown>>[];
  return checks.flatMap(([label], index) =>
    row?.[`c${String(index)}`] === true ? [label] : [],
  );
}

/**
 * Creates the site's role if missing, sets its password when asked, then
 * resets its rights and checks what it can actually do, all in one
 * transaction: run again after each migration, it changes nothing but the
 * rights of new tables. Run as the owner.
 */
export async function ensureAppRole(
  db: Database,
  options: AppRoleOptions = {},
): Promise<AppRoleOutcome> {
  if (options.password !== undefined && !isUsablePassword(options.password)) {
    throw new Error(
      "The password must be 24 to 128 letters, digits, '-' or '_'.",
    );
  }
  return db.transaction(async (tx) => {
    const before = await roleState(tx);
    const password = passwordFor(before !== undefined, options);
    await setLogin(tx, before !== undefined, password.value);
    const after = await roleState(tx);
    if (after === undefined || widerThanData(after)) {
      throw new Error(
        `The role ${APP_ROLE} holds more than data rights (an attribute or a membership): drop it (${DROP_HINT}), then run this script again.`,
      );
    }
    for (const statement of grantStatements()) {
      await tx.execute(sql.raw(statement));
    }
    const excess = await excessRights(tx);
    if (excess.length > 0) {
      throw new Error(
        `The role ${APP_ROLE} would still hold ${excess.join(", ")}: take it back as the owner (for instance REVOKE CREATE ON SCHEMA public FROM PUBLIC), then run this script again.`,
      );
    }
    return {
      created: before === undefined,
      generatedPassword: password.isGenerated ? password.value : undefined,
    };
  });
}

/** The site's connection string: the owner's, with the role's name and password. */
export function appRoleUrl(ownerUrl: string, password: string): string {
  const url = new URL(ownerUrl);
  url.username = APP_ROLE;
  url.password = password;
  return url.href;
}
