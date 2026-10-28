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
  createProjectAction,
  deleteProjectAction,
  moveProjectAction,
  updateProjectAction,
} from "./admin-actions";

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
  await testDb.exec(
    "insert into skills (slug, name, domain) values ('react', 'React', 'web'), ('rust', 'Rust', 'low_level')",
  );
});

const DEMO = {
  slug: "demo",
  domain: "web",
  status: "draft",
  repoUrl: "",
  demoUrl: "",
  startedOn: "2024-01-01",
  endedOn: "",
  "fr.title": "Démo",
  "fr.tagline": "Accroche",
  "fr.summaryContext": "Contexte",
  "fr.summaryAction": "Action",
  "fr.summaryResult": "Résultat",
  "fr.technicalMd": "",
  "fr.seoDescription": "",
};

function form(
  entries: Record<string, string>,
  skills: readonly string[] = [],
): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.append(name, value);
  }
  for (const skill of skills) {
    data.append("skills", skill);
  }
  return data;
}

async function createdProject(
  fields: Record<string, string>,
  skills: readonly string[] = [],
): Promise<string> {
  const outcome = createProjectAction(CONTENT_IDLE, form(fields, skills));
  await expect(outcome).rejects.toThrow(/^redirect:\/admin\/projects\//);
  const [row] = await testDb.query<{ id: string }>(
    `select id from projects where slug = '${fields.slug ?? ""}'`,
  );
  if (row === undefined) {
    throw new Error("Not created");
  }
  return row.id;
}

describe("project actions", () => {
  it("refuse anyone without a full session", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("redirect:/admin/login"));

    await expect(createProjectAction(CONTENT_IDLE, form(DEMO))).rejects.toThrow(
      "redirect:/admin/login",
    );
    expect(await testDb.query("select id from projects")).toEqual([]);
  });

  it("create a project with its skills in order, audit it, and open it for editing", async () => {
    const id = await createdProject(
      { ...DEMO, featured: "on", "fr.seoDescription": "" },
      ["rust", "react"],
    );

    await expect(
      createProjectAction(CONTENT_IDLE, form(DEMO)),
    ).resolves.toEqual({
      status: "invalid",
      problems: { slug: { problem: "taken" } },
    });
    expect(
      await testDb.query(
        "select featured, started_on::text, ended_on, repo_url from projects",
      ),
    ).toEqual([
      {
        featured: true,
        started_on: "2024-01-01",
        ended_on: null,
        repo_url: null,
      },
    ]);
    expect(
      await testDb.query(
        "select s.slug from project_skills l join skills s on s.id = l.skill_id order by l.sort_order",
      ),
    ).toEqual([{ slug: "rust" }, { slug: "react" }]);
    expect(
      await testDb.query("select action, entity, entity_id from audit_logs"),
    ).toEqual([
      { action: "content.created", entity: "project", entity_id: id },
    ]);
    expect(mocks.updateTag).toHaveBeenCalledWith("project:demo");
  });

  it("keep the cover chosen, and refuse one that is no image's id", async () => {
    const [image] = await testDb.query<{ id: string }>(
      `insert into media (sha256, pathname, width, height, variants)
       values ('${"a".repeat(64)}', 'media/one', 480, 270,
         '[{"width":480,"height":270,"url":"/x","bytes":1}]') returning id`,
    );
    const id = await createdProject({ ...DEMO, coverMediaId: image?.id ?? "" });

    expect(await testDb.query("select cover_media_id from projects")).toEqual([
      { cover_media_id: image?.id },
    ]);
    expect(
      await updateProjectAction(
        CONTENT_IDLE,
        form({ ...DEMO, id, coverMediaId: "not-an-id" }),
      ),
    ).toEqual({
      status: "invalid",
      problems: { coverMediaId: { problem: "invalid" } },
    });
  });

  it("refuse dates out of order on the end date, and a missing French title", async () => {
    expect(
      await createProjectAction(
        CONTENT_IDLE,
        form({ ...DEMO, endedOn: "2023-12-31", "fr.title": "" }),
      ),
    ).toEqual({
      status: "invalid",
      problems: {
        endedOn: { problem: "invalid" },
        "fr.title": { problem: "required" },
      },
    });
  });

  it("rename a published project: both pages expire, and the old slug leads to the new one", async () => {
    const id = await createdProject({ ...DEMO, status: "published" });
    vi.clearAllMocks();

    expect(
      await updateProjectAction(
        CONTENT_IDLE,
        form({ ...DEMO, id, slug: "renamed", status: "published" }),
      ),
    ).toEqual({ status: "saved" });
    expect(mocks.updateTag).toHaveBeenCalledWith("project:renamed");
    expect(mocks.updateTag).toHaveBeenCalledWith("project:demo");
    expect(
      await testDb.query("select from_slug, to_slug from slug_redirects"),
    ).toEqual([{ from_slug: "demo", to_slug: "renamed" }]);
    expect(
      await updateProjectAction(CONTENT_IDLE, form({ ...DEMO, id: "x" })),
    ).toEqual({ status: "not_found" });
  });

  it("move a project within its group, and delete it with its snapshot and its redirects", async () => {
    const first = await createdProject({ ...DEMO, slug: "first" });
    const second = await createdProject({ ...DEMO, slug: "second" });
    await testDb.exec(
      "insert into slug_redirects (collection, from_slug, to_slug) values ('projects', 'old', 'second')",
    );

    expect(
      await moveProjectAction(LIST_IDLE, form({ id: second, direction: "up" })),
    ).toEqual({ status: "done" });
    expect(
      await testDb.query("select id from projects order by sort_order"),
    ).toEqual([{ id: second }, { id: first }]);

    expect(await deleteProjectAction(LIST_IDLE, form({ id: second }))).toEqual({
      status: "done",
    });
    expect(mocks.updateTag).toHaveBeenCalledWith("project:second");
    expect(await testDb.query("select id from slug_redirects")).toEqual([]);
    const [entry] = await testDb.query<{
      diff: { row: { slug: string }; translations: { locale: string }[] };
    }>("select diff from audit_logs where action = 'content.deleted'");
    expect(entry?.diff.row.slug).toBe("second");
    expect(entry?.diff.translations).toEqual([
      expect.objectContaining({ locale: "fr" }),
    ]);
  });
});
