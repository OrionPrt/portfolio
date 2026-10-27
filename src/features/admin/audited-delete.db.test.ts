import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  projects,
  projectSkills,
  projectTranslations,
  skills,
} from "@/db/schema";
import { ok } from "@/lib/result";

import { createAdmin } from "../../../test/auth";
import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { deleteWithSnapshot } from "./audited-delete";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
});

async function actor() {
  const admin = await createAdmin(testDb.db);
  return { actorId: admin.id, ipHash: "c".repeat(64), userAgent: "Firefox" };
}

async function insertedId(statement: string): Promise<string> {
  const [row] = await testDb.query<{ id: string }>(statement);
  if (row === undefined) {
    throw new Error("Nothing inserted");
  }
  return row.id;
}

describe("deleteWithSnapshot", () => {
  it("deletes a row and keeps all of it in the audit log, in one statement", async () => {
    const by = await actor();
    const id = await insertedId(
      "insert into skills (slug, name, domain) values ('rust', 'Rust', 'low_level') returning id",
    );

    const deleted = await deleteWithSnapshot(
      testDb.db,
      { table: skills, idColumn: skills.id, id, entity: "skill" },
      by,
    );

    expect(deleted).toEqual(ok({ slug: "rust" }));
    expect(await testDb.query("select id from skills")).toEqual([]);
    const [entry] = await testDb.query<{
      action: string;
      entity: string;
      entity_id: string;
      actor_id: string;
      diff: { row: Record<string, unknown> };
    }>("select action, entity, entity_id, actor_id, diff from audit_logs");
    expect(entry).toMatchObject({
      action: "content.deleted",
      entity: "skill",
      entity_id: id,
      actor_id: by.actorId,
      diff: { row: { id, slug: "rust", name: "Rust", domain: "low_level" } },
    });
  });

  it("keeps the rows its cascade deletes: translations, links", async () => {
    const by = await actor();
    const id = await insertedId(
      "insert into projects (slug, domain) values ('demo', 'web') returning id",
    );
    const skillId = await insertedId(
      "insert into skills (slug, name, domain) values ('ts', 'TypeScript', 'web') returning id",
    );
    await testDb.exec(
      `insert into project_translations (project_id, locale, title, tagline, summary_context, summary_action, summary_result)
       values ('${id}', 'fr', 'Démo', 'Une démo', 'c', 'a', 'r'), ('${id}', 'en', 'Demo', 'A demo', 'c', 'a', 'r');
       insert into project_skills (project_id, skill_id) values ('${id}', '${skillId}')`,
    );

    await deleteWithSnapshot(
      testDb.db,
      {
        table: projects,
        idColumn: projects.id,
        id,
        entity: "project",
        related: [
          {
            key: "translations",
            table: projectTranslations,
            foreignKey: projectTranslations.projectId,
          },
          {
            key: "skills",
            table: projectSkills,
            foreignKey: projectSkills.projectId,
          },
        ],
      },
      by,
    );

    expect(
      await testDb.query("select locale from project_translations"),
    ).toEqual([]);
    const [entry] = await testDb.query<{
      diff: { translations: { locale: string; title: string }[] };
    }>("select diff from audit_logs");
    expect(
      entry?.diff.translations
        .map(({ locale, title }) => [locale, title])
        .sort(),
    ).toEqual([
      ["en", "Demo"],
      ["fr", "Démo"],
    ]);
  });

  it("deletes and audits nothing for an unknown id", async () => {
    expect(
      await deleteWithSnapshot(
        testDb.db,
        {
          table: skills,
          idColumn: skills.id,
          id: "00000000-0000-4000-8000-000000000000",
          entity: "skill",
        },
        await actor(),
      ),
    ).toEqual(ok(undefined));
    expect(await testDb.query("select id from audit_logs")).toEqual([]);
  });

  it("deletes nothing when the audit row is refused", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const id = await insertedId(
      "insert into skills (slug, name, domain) values ('go', 'Go', 'web') returning id",
    );

    const result = await deleteWithSnapshot(
      testDb.db,
      { table: skills, idColumn: skills.id, id, entity: "skill" },
      {
        actorId: "00000000-0000-4000-8000-000000000001",
        ipHash: null,
        userAgent: null,
      },
    );

    expect(result.ok).toBe(false);
    expect(await testDb.query("select slug from skills")).toEqual([
      { slug: "go" },
    ]);
    vi.restoreAllMocks();
  });
});
