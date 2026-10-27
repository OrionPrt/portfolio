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
  createExperienceAction,
  deleteExperienceAction,
  updateExperienceAction,
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

const ACME = {
  slug: "acme",
  company: "Acme",
  companyUrl: "",
  location: "Lyon",
  employmentType: "apprenticeship",
  status: "published",
  startedOn: "2024-01-01",
  endedOn: "",
  "fr.role": "Développeur",
  "fr.summaryContext": "Contexte",
  "fr.summaryAction": "Action",
  "fr.summaryResult": "Résultat",
  "fr.technicalMd": "",
  "en.role": "",
  "en.summaryContext": "",
  "en.summaryAction": "",
  "en.summaryResult": "",
  "en.technicalMd": "",
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

async function createdExperience(
  fields: Record<string, string>,
  skills: readonly string[] = [],
): Promise<string> {
  const outcome = createExperienceAction(CONTENT_IDLE, form(fields, skills));
  await expect(outcome).rejects.toThrow(/^redirect:\/admin\/experiences\//);
  const [row] = await testDb.query<{ id: string }>(
    `select id from experiences where slug = '${fields.slug ?? ""}'`,
  );
  if (row === undefined) {
    throw new Error("Not created");
  }
  return row.id;
}

describe("experience actions", () => {
  it("refuse anyone without a full session", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("redirect:/admin/login"));

    await expect(
      createExperienceAction(CONTENT_IDLE, form(ACME)),
    ).rejects.toThrow("redirect:/admin/login");
    expect(await testDb.query("select id from experiences")).toEqual([]);
  });

  it("create a current position with its skills, English left to the French, and audit it", async () => {
    const id = await createdExperience(ACME, ["react"]);

    expect(
      await testDb.query(
        "select employment_type, location, ended_on from experiences",
      ),
    ).toEqual([
      { employment_type: "apprenticeship", location: "Lyon", ended_on: null },
    ]);
    expect(
      await testDb.query("select locale from experience_translations"),
    ).toEqual([{ locale: "fr" }]);
    expect(
      await testDb.query("select action, entity, entity_id from audit_logs"),
    ).toEqual([
      { action: "content.created", entity: "experience", entity_id: id },
    ]);
    expect(mocks.updateTag).toHaveBeenCalledWith("experience:acme");
  });

  it("refuse a missing start, and an end before it on the end date", async () => {
    expect(
      await createExperienceAction(
        CONTENT_IDLE,
        form({ ...ACME, startedOn: "", employmentType: "contract" }),
      ),
    ).toEqual({
      status: "invalid",
      problems: {
        startedOn: { problem: "required" },
        employmentType: { problem: "invalid" },
      },
    });
    expect(
      await createExperienceAction(
        CONTENT_IDLE,
        form({ ...ACME, endedOn: "2023-01-01" }),
      ),
    ).toEqual({
      status: "invalid",
      problems: { endedOn: { problem: "invalid" } },
    });
  });

  it("rename a published experience, then delete it with its snapshot and redirects", async () => {
    const id = await createdExperience(ACME);

    expect(
      await updateExperienceAction(
        CONTENT_IDLE,
        form({ ...ACME, id, slug: "acme-sa" }),
      ),
    ).toEqual({ status: "saved" });
    expect(mocks.updateTag).toHaveBeenCalledWith("experience:acme");
    expect(
      await testDb.query("select from_slug, to_slug from slug_redirects"),
    ).toEqual([{ from_slug: "acme", to_slug: "acme-sa" }]);

    expect(await deleteExperienceAction(LIST_IDLE, form({ id }))).toEqual({
      status: "done",
    });
    expect(await testDb.query("select id from slug_redirects")).toEqual([]);
    const [entry] = await testDb.query<{
      diff: { row: { slug: string }; translations: { locale: string }[] };
    }>("select diff from audit_logs where action = 'content.deleted'");
    expect(entry?.diff.row.slug).toBe("acme-sa");
    expect(
      await updateExperienceAction(CONTENT_IDLE, form({ ...ACME, id })),
    ).toEqual({ status: "not_found" });
  });
});
