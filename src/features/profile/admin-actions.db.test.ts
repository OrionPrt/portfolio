import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { CONTENT_IDLE } from "@/features/admin/content-form-state";
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

import { saveProfileAction } from "./admin-actions";

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

const FRENCH = {
  "fr.headline": "Ingénieur",
  "fr.availability": "Disponible",
  "fr.pitch": "Je construis.",
  "fr.aboutMd": "## Parcours",
  "fr.lookingFor": "",
};

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.append(name, value);
  }
  return data;
}

describe("saveProfileAction", () => {
  it("refuses anyone without a full session, before reading the form", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("redirect:/admin/login"));

    await expect(
      saveProfileAction(
        CONTENT_IDLE,
        form({ displayName: "Orion", ...FRENCH }),
      ),
    ).rejects.toThrow("redirect:");
    expect(await testDb.query("select id from profile")).toEqual([]);
  });

  it("saves the profile, audits it, and expires the profile's cache", async () => {
    const result = await saveProfileAction(
      CONTENT_IDLE,
      form({
        displayName: "Orion",
        location: "",
        ...FRENCH,
        "en.headline": "Engineer",
        "en.availability": "Available",
        "en.pitch": "I build.",
        "en.aboutMd": "",
        "en.lookingFor": "",
      }),
    );

    expect(result).toMatchObject({ status: "saved" });
    expect(
      await testDb.query(
        "select locale, headline, looking_for from profile_translations order by locale",
      ),
    ).toEqual([
      // An enum sorts in its declared order.
      { locale: "fr", headline: "Ingénieur", looking_for: null },
      { locale: "en", headline: "Engineer", looking_for: null },
    ]);
    expect(
      await testDb.query("select display_name, location from profile"),
    ).toEqual([{ display_name: "Orion", location: null }]);
    expect(
      await testDb.query("select action, entity, entity_id from audit_logs"),
    ).toEqual([
      { action: "content.updated", entity: "profile", entity_id: "1" },
    ]);
    expect(mocks.updateTag).toHaveBeenCalledWith("profile");
    // The page refreshes: the form starts again from what was stored.
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("leaves English out when it is blank, the audit log keeping what it said", async () => {
    await saveProfileAction(
      CONTENT_IDLE,
      form({
        displayName: "Orion",
        ...FRENCH,
        "en.headline": "Engineer",
        "en.availability": "Available",
        "en.pitch": "I build.",
      }),
    );

    await saveProfileAction(
      CONTENT_IDLE,
      form({ displayName: "Orion", ...FRENCH, "en.headline": " " }),
    );

    expect(
      await testDb.query("select locale from profile_translations"),
    ).toEqual([{ locale: "fr" }]);
    const [last] = await testDb.query<{
      diff: { removedTranslations: { locale: string; headline: string }[] };
    }>("select diff from audit_logs order by id desc limit 1");
    expect(last?.diff.removedTranslations).toEqual([
      expect.objectContaining({ locale: "en", headline: "Engineer" }),
    ]);
  });

  it("names each refused field, and writes nothing", async () => {
    const result = await saveProfileAction(
      CONTENT_IDLE,
      form({
        displayName: "",
        ...FRENCH,
        "fr.headline": "",
        "en.pitch": "Only this",
      }),
    );

    expect(result).toMatchObject({
      status: "invalid",
      problems: {
        displayName: { problem: "required" },
        "fr.headline": { problem: "required" },
        "en.headline": { problem: "required" },
      },
    });
    expect(await testDb.query("select id from profile")).toEqual([]);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });
});
