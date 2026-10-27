import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ok } from "@/lib/result";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createSkillsAdminRepository } from "./skills-admin-repository";

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

const RUST = {
  slug: "rust",
  name: "Rust",
  domain: "low_level",
  featured: true,
  sortOrder: 0,
} as const;

async function created(
  skill:
    | typeof RUST
    | {
        slug: string;
        name: string;
        domain: "web" | "low_level";
        featured: boolean;
        sortOrder: number;
      },
) {
  const outcome = await createSkillsAdminRepository(testDb.db).create(skill);
  if (!outcome.ok || outcome.data.status !== "saved") {
    throw new Error("Not created");
  }
  return outcome.data.id;
}

describe("skills admin repository", () => {
  it("creates a skill at the end of its domain, and finds it", async () => {
    const skills = createSkillsAdminRepository(testDb.db);
    await created({ ...RUST, slug: "c", name: "C" });

    const id = await created(RUST);

    expect(await skills.find(id)).toEqual(
      ok({
        id,
        slug: "rust",
        name: "Rust",
        domain: "low_level",
        featured: true,
        sortOrder: 1,
        projectCount: 0,
        experienceCount: 0,
      }),
    );
  });

  it("refuses a slug another skill holds", async () => {
    await created(RUST);

    expect(
      await createSkillsAdminRepository(testDb.db).create({
        ...RUST,
        name: "Other",
      }),
    ).toEqual(ok({ status: "conflict", field: "slug" }));
  });

  it("updates a skill, and says when its slug is taken or it is gone", async () => {
    const skills = createSkillsAdminRepository(testDb.db);
    const rust = await created(RUST);
    await created({ ...RUST, slug: "go", name: "Go" });

    expect(
      await skills.update(rust, {
        ...RUST,
        name: "Rust (lang)",
        featured: false,
      }),
    ).toEqual(ok({ status: "saved", id: rust, isNew: false }));
    expect(await skills.find(rust)).toMatchObject(
      ok({ name: "Rust (lang)", featured: false }),
    );
    expect(await skills.update(rust, { ...RUST, slug: "go" })).toEqual(
      ok({ status: "conflict", field: "slug" }),
    );
    expect(
      await skills.update("00000000-0000-4000-8000-000000000000", RUST),
    ).toEqual(ok({ status: "not_found" }));
  });

  it("lists skills by domain and order, with how many entries use each", async () => {
    const skills = createSkillsAdminRepository(testDb.db);
    const ts = await created({
      slug: "ts",
      name: "TypeScript",
      domain: "web",
      featured: false,
      sortOrder: 0,
    });
    const rust = await created(RUST);
    const project = await testDb.query<{ id: string }>(
      "insert into projects (slug, domain) values ('demo', 'web') returning id",
    );
    await testDb.exec(
      `insert into project_skills (project_id, skill_id) values ('${project[0]?.id ?? ""}', '${ts}')`,
    );

    const listed = await skills.list();

    expect(
      listed.ok &&
        listed.data.map(({ id, projectCount, experienceCount }) => [
          id,
          projectCount,
          experienceCount,
        ]),
    ).toEqual([
      [ts, 1, 0],
      [rust, 0, 0],
    ]);
  });

  it("orders a domain's skills as given", async () => {
    const skills = createSkillsAdminRepository(testDb.db);
    const c = await created({ ...RUST, slug: "c", name: "C" });
    const rust = await created(RUST);

    expect(await skills.siblings(rust)).toEqual(ok([c, rust]));
    expect(await skills.reorder([rust, c])).toEqual(ok(undefined));
    expect(await skills.siblings(rust)).toEqual(ok([rust, c]));
  });

  it("refuses one skill more than the site can show", async () => {
    await testDb.exec(
      "insert into skills (slug, name, domain) select 'skill-' || n, 'Skill ' || n, 'web' from generate_series(1, 200) as n",
    );

    expect(await createSkillsAdminRepository(testDb.db).create(RUST)).toEqual(
      ok({ status: "full" }),
    );
  });
});
