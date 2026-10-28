import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { CertificationContent } from "@/features/content/schemas";
import { ok } from "@/lib/result";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createCertificationsAdminRepository } from "./certifications-admin-repository";

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

function input(
  overrides: Partial<CertificationContent> = {},
): CertificationContent {
  return {
    name: "OSCP",
    issuer: "OffSec",
    issuedOn: "2024-03-01",
    expiresOn: null,
    credentialId: "OS-101-12345",
    verifyUrl: "https://credentials.offsec.com/12345",
    badgeMediaId: null,
    sortOrder: 0,
    translations: { fr: { description: "Test d'intrusion" } },
    ...overrides,
  };
}

function repository() {
  return createCertificationsAdminRepository(testDb.db);
}

async function created(overrides: Partial<CertificationContent> = {}) {
  const outcome = await repository().create(input(overrides));
  if (!outcome.ok || outcome.data.status !== "saved") {
    throw new Error("Not created");
  }
  return outcome.data.id;
}

describe("certifications admin repository", () => {
  it("creates a certification with a slug drawn from its name, and finds it", async () => {
    const id = await created();
    await created({ name: "OSCP", issuedOn: "2025-03-01" });

    expect(await repository().find(id)).toEqual(ok({ ...input(), id }));
    expect(
      await testDb.query("select slug from certifications order by issued_on"),
    ).toEqual([{ slug: "oscp" }, { slug: "oscp-2" }]);
  });

  it("lists the latest first, the expired ones said so; English is wanted only where the French says something", async () => {
    await created({
      name: "Old",
      issuedOn: "2020-01-01",
      expiresOn: "2023-01-01",
    });
    await created({
      name: "Silent",
      issuedOn: "2022-01-01",
      translations: { fr: { description: "" } },
    });
    await created({
      name: "Both",
      issuedOn: "2024-01-01",
      expiresOn: "2027-01-01",
      translations: {
        fr: { description: "Cloud" },
        en: { description: "Cloud" },
      },
    });

    const listed = await repository().list();

    expect(
      listed.ok &&
        listed.data.map(({ name, expiresOn, isExpired, english }) => [
          name,
          expiresOn,
          isExpired,
          english,
        ]),
    ).toEqual([
      ["Both", "2027-01-01", false, "complete"],
      ["Silent", null, false, "complete"],
      ["Old", "2023-01-01", true, "missing"],
    ]);
  });

  it("updates a certification, keeping its slug, and says when it is gone", async () => {
    const id = await created({
      translations: {
        fr: { description: "Test d'intrusion" },
        en: { description: "Penetration testing" },
      },
    });

    expect(
      await repository().update(
        id,
        input({ name: "OSCP+", credentialId: null, verifyUrl: null }),
      ),
    ).toEqual(
      ok({
        status: "saved",
        id,
        isNew: false,
        diff: {
          removedTranslations: [
            { locale: "en", description: "Penetration testing" },
          ],
        },
      }),
    );
    expect(
      await testDb.query(
        "select slug, name, credential_id from certifications",
      ),
    ).toEqual([{ slug: "oscp", name: "OSCP+", credential_id: null }]);
    expect(
      await repository().update(
        "00000000-0000-4000-8000-000000000000",
        input(),
      ),
    ).toEqual(ok({ status: "not_found" }));
  });
});
