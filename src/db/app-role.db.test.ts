import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAdmin } from "../../test/auth";
import { createTestDatabase, type TestDatabase } from "../../test/db";
import { insertProject } from "../../test/fixtures/content";
import {
  appRoleUrl,
  ensureAppRole,
  generatePassword,
  isUsablePassword,
} from "./app-role";
import { APP_ROLE } from "./settings";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.exec("reset role");
  await testDb.reset();
  await testDb.exec(`
    drop table if exists later;
    do $$ begin
      if exists (select from pg_roles where rolname = '${APP_ROLE}') then
        drop owned by ${APP_ROLE};
        drop role ${APP_ROLE};
      end if;
    end $$;`);
});

/** Runs a statement as the site's role: its error message, or "ok". */
async function asApp(statement: string): Promise<string> {
  await testDb.exec(`set role ${APP_ROLE}`);
  try {
    await testDb.exec(statement);
    return "ok";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await testDb.exec("reset role");
  }
}

const DENIED = /permission denied/;

describe("ensureAppRole", () => {
  it("creates the role with a generated password, once", async () => {
    const first = await ensureAppRole(testDb.db);
    const second = await ensureAppRole(testDb.db);

    expect(first.created).toBe(true);
    expect(isUsablePassword(first.generatedPassword ?? "")).toBe(true);
    expect(second).toEqual({ created: false, generatedPassword: undefined });
    expect(
      await testDb.query(
        `select rolcanlogin, rolsuper, rolcreaterole, rolcreatedb from pg_roles where rolname = '${APP_ROLE}'`,
      ),
    ).toEqual([
      {
        rolcanlogin: true,
        rolsuper: false,
        rolcreaterole: false,
        rolcreatedb: false,
      },
    ]);
  });

  it("lets the site read and change data", async () => {
    await ensureAppRole(testDb.db);

    expect(
      await asApp(
        "insert into skills (slug, name, domain) values ('rust', 'Rust', 'low_level')",
      ),
    ).toBe("ok");
    expect(await asApp("update skills set name = 'Rust lang'")).toBe("ok");
    expect(await asApp("select * from skills")).toBe("ok");
    expect(await asApp("delete from skills")).toBe("ok");
  });

  it("lets the site add to the audit log, never rewrite it", async () => {
    await ensureAppRole(testDb.db);

    expect(
      await asApp("insert into audit_logs (action) values ('content.updated')"),
    ).toBe("ok");
    expect(await asApp("select * from audit_logs")).toBe("ok");
    expect(await asApp("update audit_logs set action = 'x.y'")).toMatch(DENIED);
    expect(await asApp("delete from audit_logs")).toMatch(DENIED);
    expect(await asApp("truncate audit_logs")).toMatch(DENIED);
  });

  it("runs the site's own writes: an audited deletion, an upsert, a cascade, an actor's event", async () => {
    await ensureAppRole(testDb.db);
    const admin = await createAdmin(testDb.db);
    const project = await insertProject(testDb.db, { slug: "doomed" });

    expect(
      await asApp(
        `insert into audit_logs (actor_id, action) values ('${admin.id}', 'auth.signed_out')`,
      ),
    ).toBe("ok");
    expect(
      await asApp(`insert into skills (slug, name, domain) values ('go', 'Go', 'web')
        on conflict (slug) do update set name = excluded.name`),
    ).toBe("ok");
    // Its translations go with it (on delete cascade), its snapshot to the log.
    expect(
      await asApp(`with deleted as (delete from projects where id = '${project}' returning id)
        insert into audit_logs (action, entity_id) select 'content.deleted', id::text from deleted`),
    ).toBe("ok");
    expect(
      await testDb.query(
        `select count(*)::int as left from project_translations where project_id = '${project}'`,
      ),
    ).toEqual([{ left: 0 }]);
  });

  it("refuses the site to delete the admin account, which would clear the log's actor", async () => {
    await ensureAppRole(testDb.db);
    await createAdmin(testDb.db);

    expect(await asApp("delete from admin_users")).toMatch(DENIED);
    expect(await asApp("update admin_users set totp_last_step = 1")).toBe("ok");
  });

  it("gives no sequence, so no audit id is burnt by hand", async () => {
    await ensureAppRole(testDb.db);

    expect(await asApp("select nextval('audit_logs_id_seq')")).toMatch(DENIED);
  });

  it("stops the role's queries on the server when the site gives up on them", async () => {
    await ensureAppRole(testDb.db);

    expect(
      await testDb.query(
        `select rolconfig from pg_roles where rolname = '${APP_ROLE}'`,
      ),
    ).toEqual([{ rolconfig: ["statement_timeout=8000"] }]);
  });

  it("refuses to finish while PUBLIC lets everyone create in the public schema", async () => {
    await testDb.exec("grant create on schema public to public");
    try {
      await expect(ensureAppRole(testDb.db)).rejects.toThrow(
        /would still hold CREATE on schema public/,
      );
    } finally {
      await testDb.exec("revoke create on schema public from public");
    }
    // The transaction left nothing behind.
    expect(
      await testDb.query(
        `select 1 from pg_roles where rolname = '${APP_ROLE}'`,
      ),
    ).toEqual([]);
  });

  it.each([
    ["create a table", "create table intruder (id int)"],
    ["drop a table", "drop table skills"],
    ["alter a table", "alter table skills add column x int"],
    ["empty a table", "truncate skills"],
    ["read the migrations", "select * from drizzle.__drizzle_migrations"],
  ])("refuses the site to %s", async (_case, statement) => {
    await ensureAppRole(testDb.db);

    expect(await asApp(statement)).toMatch(/permission denied|must be owner/);
  });

  it("gives the same rights on the tables a later migration creates", async () => {
    await ensureAppRole(testDb.db);
    await testDb.exec("create table later (id int)");

    expect(await asApp("insert into later values (1)")).toBe("ok");
    expect(await asApp("truncate later")).toMatch(DENIED);
  });

  it("sets a password given, every time, and rotates one on request", async () => {
    const given = "ci-only-app-role-password-0001";
    expect(await ensureAppRole(testDb.db, { password: given })).toEqual({
      created: true,
      generatedPassword: undefined,
    });

    const rotated = await ensureAppRole(testDb.db, { rotate: true });

    expect(rotated.created).toBe(false);
    expect(rotated.generatedPassword).not.toBe(given);
    expect(isUsablePassword(rotated.generatedPassword ?? "")).toBe(true);
  });

  it("refuses a password that would need quoting", async () => {
    await expect(
      ensureAppRole(testDb.db, { password: "short'; drop role postgres; --" }),
    ).rejects.toThrow(/letters, digits/);
    expect(
      await testDb.query(
        `select 1 from pg_roles where rolname = '${APP_ROLE}'`,
      ),
    ).toEqual([]);
  });

  it.each([
    ["an attribute", `create role ${APP_ROLE} login createdb`],
    [
      "a membership",
      `create role wide; create role ${APP_ROLE} login in role wide`,
    ],
  ])(
    "refuses a role that holds %s beyond data rights",
    async (_case, setup) => {
      await testDb.exec(setup);

      await expect(ensureAppRole(testDb.db)).rejects.toThrow(
        /more than data rights/,
      );
      await testDb.exec(`drop role ${APP_ROLE}; drop role if exists wide`);
    },
  );
});

describe("appRoleUrl", () => {
  it("keeps the owner's host, database and options, with the role's name", () => {
    expect(
      appRoleUrl(
        "postgresql://neondb_owner:secret@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require",
        "abc_DEF-123",
      ),
    ).toBe(
      `postgresql://${APP_ROLE}:abc_DEF-123@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require`,
    );
  });
});

describe("generatePassword", () => {
  it("draws a new usable password each time", () => {
    const passwords = new Set(
      Array.from({ length: 20 }, () => generatePassword()),
    );

    expect(passwords.size).toBe(20);
    expect([...passwords].every(isUsablePassword)).toBe(true);
  });
});
