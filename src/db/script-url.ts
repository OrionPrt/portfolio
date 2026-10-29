import type { ServerEnv } from "@/lib/env";

/** Who a script connects as: the owner (DDL, roles, seed) or the site's role. */
export type ScriptRole = "owner" | "app";

export interface ScriptDatabase {
  readonly url: string;
  /** Named in the script's output: which variable was read. */
  readonly variable: "DATABASE_OWNER_URL" | "DATABASE_URL";
}

type DatabaseEnv = Pick<ServerEnv, "DATABASE_URL" | "DATABASE_OWNER_URL">;

/**
 * The owner's URL for migrations, the seed and the roles, else the site's (a
 * local database with one user): with the site's role, a migration fails for
 * want of rights rather than run as someone else. The admin commands only
 * change data: they run as the site does.
 */
export function scriptDatabase(
  env: DatabaseEnv,
  role: ScriptRole,
): ScriptDatabase | undefined {
  if (role === "owner" && env.DATABASE_OWNER_URL !== undefined) {
    return { url: env.DATABASE_OWNER_URL, variable: "DATABASE_OWNER_URL" };
  }
  return env.DATABASE_URL === undefined
    ? undefined
    : { url: env.DATABASE_URL, variable: "DATABASE_URL" };
}

/** "user@host": which database and as whom, never the password. */
export function describeTarget({ url, variable }: ScriptDatabase): string {
  const { username, host } = new URL(url);
  return `${variable}, ${decodeURIComponent(username)}@${host}`;
}
