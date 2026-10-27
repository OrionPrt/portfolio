import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { CONTENT_IDLE, LIST_IDLE } from "@/features/admin/content-form-state";
import { ok } from "@/lib/result";

import { createAdmin } from "../../../test/auth";
import { createTestDatabase, type TestDatabase } from "../../../test/db";

let testDb: TestDatabase;

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  checkedRequest: vi.fn(),
  updateTag: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/features/auth/dal", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/features/auth/checked-request", () => ({
  checkedRequest: mocks.checkedRequest,
}));
vi.mock("@/db/client", () => ({
  withDatabase: (run: (db: unknown) => unknown) => run(testDb.db),
}));
vi.mock("next/cache", () => ({
  updateTag: mocks.updateTag,
  refresh: mocks.refresh,
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

import {
  createSkillAction,
  deleteSkillAction,
  moveSkillAction,
  updateSkillAction,
} from "./skills-admin-actions";

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  vi.clearAllMocks();
  const admin = await createAdmin(testDb.db);
  mocks.requireAdmin.mockResolvedValue({
    sessionId: "a".repeat(64),
    stage: "signed_in",
    expiresAt: new Date(),
    user: { id: admin.id, email: admin.email },
  });
  mocks.checkedRequest.mockResolvedValue(
    ok({
      config: {},
      context: { networkHash: "c".repeat(64), userAgent: null },
    }),
  );
});

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.append(name, value);
  }
  return data;
}

const RUST = { slug: "rust", name: "Rust", domain: "low_level" };

async function skillIds(): Promise<string[]> {
  const rows = await testDb.query<{ id: string }>(
    "select id from skills order by sort_order, name",
  );
  return rows.map((row) => row.id);
}

async function createdSkill(fields: Record<string, string>): Promise<string> {
  await expect(createSkillAction(CONTENT_IDLE, form(fields))).rejects.toThrow(
    "redirect:/admin/skills",
  );
  const [row] = await testDb.query<{ id: string }>(
    `select id from skills where slug = '${fields.slug ?? ""}'`,
  );
  if (row === undefined) {
    throw new Error("Not created");
  }
  return row.id;
}

describe("skill actions", () => {
  it("refuse anyone without a full session", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("redirect:/admin/login"));

    await expect(createSkillAction(CONTENT_IDLE, form(RUST))).rejects.toThrow(
      "redirect:/admin/login",
    );
    await expect(
      deleteSkillAction(
        LIST_IDLE,
        form({ id: "00000000-0000-4000-8000-000000000000" }),
      ),
    ).rejects.toThrow("redirect:/admin/login");
    expect(await skillIds()).toEqual([]);
  });

  it("create a skill, audit it, expire the skills' cache, and go back to the list", async () => {
    const id = await createdSkill({ ...RUST, featured: "on" });

    expect(
      await testDb.query("select name, domain, featured from skills"),
    ).toEqual([{ name: "Rust", domain: "low_level", featured: true }]);
    expect(
      await testDb.query("select action, entity, entity_id from audit_logs"),
    ).toEqual([{ action: "content.created", entity: "skill", entity_id: id }]);
    expect(mocks.updateTag).toHaveBeenCalledWith("skills");
  });

  it("refuse an invalid slug, or one taken, on the slug field", async () => {
    await createdSkill(RUST);

    expect(
      await createSkillAction(
        CONTENT_IDLE,
        form({ ...RUST, slug: "Not A Slug" }),
      ),
    ).toEqual({
      status: "invalid",
      problems: { slug: { problem: "invalid" } },
    });
    expect(
      await createSkillAction(CONTENT_IDLE, form({ ...RUST, name: "Rust 2" })),
    ).toEqual({ status: "invalid", problems: { slug: { problem: "taken" } } });
  });

  it("update a skill, or say it is gone", async () => {
    const id = await createdSkill(RUST);

    expect(
      await updateSkillAction(
        CONTENT_IDLE,
        form({ ...RUST, id, name: "Rust (lang)" }),
      ),
    ).toMatchObject({ status: "saved" });
    expect(await testDb.query("select name from skills")).toEqual([
      { name: "Rust (lang)" },
    ]);
    expect(
      await updateSkillAction(CONTENT_IDLE, form({ ...RUST, id: "not-an-id" })),
    ).toEqual({ status: "not_found" });
  });

  it("move a skill within its domain, audited", async () => {
    const c = await createdSkill({ ...RUST, slug: "c", name: "C" });
    const rust = await createdSkill(RUST);

    expect(
      await moveSkillAction(LIST_IDLE, form({ id: rust, direction: "up" })),
    ).toEqual({ status: "done" });
    expect(await skillIds()).toEqual([rust, c]);
    expect(mocks.refresh).toHaveBeenCalled();
    expect(
      await testDb.query(
        "select entity_id from audit_logs where action = 'content.reordered'",
      ),
    ).toEqual([{ entity_id: rust }]);
  });

  it("delete a skill with a snapshot of it and its links", async () => {
    const id = await createdSkill(RUST);
    const [project] = await testDb.query<{ id: string }>(
      "insert into projects (slug, domain) values ('demo', 'web') returning id",
    );
    await testDb.exec(
      `insert into project_skills (project_id, skill_id) values ('${project?.id ?? ""}', '${id}')`,
    );

    expect(await deleteSkillAction(LIST_IDLE, form({ id }))).toEqual({
      status: "done",
    });
    expect(mocks.refresh).toHaveBeenCalled();

    expect(await skillIds()).toEqual([]);
    const [entry] = await testDb.query<{
      diff: { row: { slug: string }; projects: { project_id: string }[] };
    }>("select diff from audit_logs where action = 'content.deleted'");
    expect(entry?.diff.row.slug).toBe("rust");
    expect(entry?.diff.projects).toEqual([
      expect.objectContaining({ project_id: project?.id }),
    ]);
  });

  it("answer not found for an unknown or malformed id", async () => {
    expect(
      await deleteSkillAction(
        LIST_IDLE,
        form({ id: "00000000-0000-4000-8000-000000000000" }),
      ),
    ).toEqual({ status: "not_found" });
    expect(
      await moveSkillAction(LIST_IDLE, form({ id: "x", direction: "up" })),
    ).toEqual({ status: "not_found" });
  });

  it("leave an entry at the end of its list where it is, and report an outage", async () => {
    const rust = await createdSkill(RUST);

    expect(
      await moveSkillAction(LIST_IDLE, form({ id: rust, direction: "up" })),
    ).toEqual({ status: "done" });
    expect(
      await testDb.query(
        "select id from audit_logs where action = 'content.reordered'",
      ),
    ).toEqual([]);

    mocks.checkedRequest.mockResolvedValue({ ok: false, error: "unavailable" });
    expect(
      await moveSkillAction(LIST_IDLE, form({ id: rust, direction: "down" })),
    ).toEqual({ status: "unavailable" });
    expect(await deleteSkillAction(LIST_IDLE, form({ id: rust }))).toEqual({
      status: "unavailable",
    });
    expect(
      await updateSkillAction(CONTENT_IDLE, form({ ...RUST, id: rust })),
    ).toEqual({ status: "unavailable" });
  });
});
