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
  createCertificationAction,
  deleteCertificationAction,
  updateCertificationAction,
} from "./certifications-admin-actions";
import {
  createEducationAction,
  deleteEducationAction,
  updateEducationAction,
} from "./education-admin-actions";

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

const INSA = {
  school: "INSA Lyon",
  location: "",
  startedOn: "2018-09-01",
  endedOn: "",
  "fr.degree": "Diplôme d'ingénieur",
  "fr.description": "",
  "en.degree": "",
  "en.description": "",
};

const OSCP = {
  name: "OSCP",
  issuer: "OffSec",
  issuedOn: "2024-03-01",
  expiresOn: "",
  credentialId: "",
  verifyUrl: "https://credentials.offsec.com/1",
  "fr.description": "Test d'intrusion",
  "en.description": "",
};

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.append(name, value);
  }
  return data;
}

/** Created, the entry opens for editing: its id comes from that redirect. */
async function createdId(
  outcome: Promise<unknown>,
  list: string,
): Promise<string> {
  const redirected = await outcome.then(
    () => undefined,
    (error: unknown) => (error instanceof Error ? error.message : undefined),
  );
  const [, page, id] =
    /^redirect:\/admin\/([a-z]+)\/([0-9a-f-]{36})$/.exec(redirected ?? "") ??
    [];
  if (page !== list || id === undefined) {
    throw new Error(`Not created: ${String(redirected)}`);
  }
  return id;
}

describe("education actions", () => {
  it("refuse anyone without a full session", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("redirect:/admin/login"));

    await expect(
      createEducationAction(CONTENT_IDLE, form(INSA)),
    ).rejects.toThrow("redirect:/admin/login");
    expect(await testDb.query("select id from education")).toEqual([]);
  });

  it("create an entry still under way, audit it, and expire the education cache", async () => {
    const id = await createdId(
      createEducationAction(CONTENT_IDLE, form(INSA)),
      "education",
    );

    expect(
      await testDb.query("select slug, location, ended_on from education"),
    ).toEqual([
      { slug: "insa-lyon-diplome-d-ingenieur", location: null, ended_on: null },
    ]);
    expect(
      await testDb.query("select locale from education_translations"),
    ).toEqual([{ locale: "fr" }]);
    expect(
      await testDb.query("select action, entity, entity_id from audit_logs"),
    ).toEqual([
      { action: "content.created", entity: "education", entity_id: id },
    ]);
    expect(mocks.updateTag).toHaveBeenCalledWith("education");
  });

  it("refuse a missing start, and an English description without its degree", async () => {
    expect(
      await createEducationAction(
        CONTENT_IDLE,
        form({ ...INSA, startedOn: "", "en.description": "Computing" }),
      ),
    ).toEqual({
      status: "invalid",
      problems: {
        startedOn: { problem: "required" },
        "en.degree": { problem: "required" },
      },
    });
  });

  it("update an entry, then delete it with a snapshot of its languages", async () => {
    const id = await createdId(
      createEducationAction(CONTENT_IDLE, form(INSA)),
      "education",
    );

    expect(
      await updateEducationAction(
        CONTENT_IDLE,
        form({ ...INSA, id, endedOn: "2023-06-30" }),
      ),
    ).toEqual({ status: "saved" });
    expect(await deleteEducationAction(LIST_IDLE, form({ id }))).toEqual({
      status: "done",
    });
    const [entry] = await testDb.query<{
      diff: { row: { school: string }; translations: { degree: string }[] };
    }>("select diff from audit_logs where action = 'content.deleted'");
    expect(entry?.diff.row.school).toBe("INSA Lyon");
    expect(entry?.diff.translations).toEqual([
      expect.objectContaining({ degree: "Diplôme d'ingénieur" }),
    ]);
    expect(
      await updateEducationAction(CONTENT_IDLE, form({ ...INSA, id })),
    ).toEqual({ status: "not_found" });
  });
});

describe("certification actions", () => {
  it("create a certification, audit it, and expire the certifications' cache", async () => {
    const id = await createdId(
      createCertificationAction(CONTENT_IDLE, form(OSCP)),
      "certifications",
    );

    expect(
      await testDb.query(
        "select slug, credential_id, verify_url from certifications",
      ),
    ).toEqual([
      {
        slug: "oscp",
        credential_id: null,
        verify_url: "https://credentials.offsec.com/1",
      },
    ]);
    expect(
      await testDb.query("select action, entity, entity_id from audit_logs"),
    ).toEqual([
      { action: "content.created", entity: "certification", entity_id: id },
    ]);
    expect(mocks.updateTag).toHaveBeenCalledWith("certifications");
  });

  it("refuse an http link, and an expiry before the issue, on their fields", async () => {
    expect(
      await createCertificationAction(
        CONTENT_IDLE,
        form({
          ...OSCP,
          verifyUrl: "http://credentials.offsec.com/1",
          expiresOn: "2024-01-01",
        }),
      ),
    ).toEqual({
      status: "invalid",
      problems: {
        verifyUrl: { problem: "invalid" },
        expiresOn: { problem: "invalid" },
      },
    });
  });

  it("update a certification, then delete it", async () => {
    const id = await createdId(
      createCertificationAction(CONTENT_IDLE, form(OSCP)),
      "certifications",
    );

    expect(
      await updateCertificationAction(
        CONTENT_IDLE,
        form({ ...OSCP, id, expiresOn: "2027-03-01" }),
      ),
    ).toEqual({ status: "saved" });
    expect(
      await testDb.query("select expires_on::text from certifications"),
    ).toEqual([{ expires_on: "2027-03-01" }]);
    expect(await deleteCertificationAction(LIST_IDLE, form({ id }))).toEqual({
      status: "done",
    });
    expect(await testDb.query("select id from certifications")).toEqual([]);
    expect(
      await updateCertificationAction(CONTENT_IDLE, form({ ...OSCP, id: "x" })),
    ).toEqual({ status: "not_found" });
  });
});
