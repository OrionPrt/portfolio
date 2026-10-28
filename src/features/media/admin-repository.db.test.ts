import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { certifications } from "@/db/schema";
import { ok } from "@/lib/result";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import {
  insertExperience,
  insertProject,
} from "../../../test/fixtures/content";
import { createMediaAdminRepository, type NewMedia } from "./admin-repository";

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

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const OTHER = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

function image(overrides: Partial<NewMedia> = {}): NewMedia {
  return {
    id: ID,
    sha256: "a".repeat(64),
    pathname: `media/${ID}`,
    width: 960,
    height: 540,
    variants: [
      {
        width: 480,
        height: 270,
        url: `/api/media/media/${ID}/480.webp`,
        bytes: 10,
      },
      {
        width: 960,
        height: 540,
        url: `/api/media/media/${ID}/960.webp`,
        bytes: 30,
      },
    ],
    alt: { fr: "Capture du tableau de bord", en: "Dashboard screenshot" },
    ...overrides,
  };
}

function repository() {
  return createMediaAdminRepository(testDb.db);
}

describe("media admin repository", () => {
  it("stores an image with both alternative texts, and finds it by its file", async () => {
    expect(await repository().create(image())).toEqual(ok(undefined));

    expect(await repository().idOfFile("a".repeat(64))).toEqual(ok(ID));
    expect(await repository().idOfFile("b".repeat(64))).toEqual(ok(undefined));
    expect(await repository().count()).toEqual(ok(1));
    const found = await repository().find(ID);
    expect(found).toEqual(
      ok({
        id: ID,
        width: 960,
        height: 540,
        variants: image().variants,
        alt: image().alt,
        usages: [],
      }),
    );
  });

  it("lists the latest first, each with its French text, thumbnail and use", async () => {
    await repository().create(image());
    await repository().create(
      image({
        id: OTHER,
        sha256: "b".repeat(64),
        pathname: `media/${OTHER}`,
        alt: { fr: "Logo", en: "Logo" },
      }),
    );
    await insertProject(testDb.db, { slug: "demo", coverMediaId: ID });
    await insertExperience(testDb.db, { slug: "acme", logoMediaId: ID });

    const listed = await repository().list();

    expect(
      listed.ok &&
        listed.data.map(({ id, alt, thumbnail, usageCount }) => [
          id,
          alt,
          thumbnail.width,
          usageCount,
        ]),
    ).toEqual([
      [OTHER, "Logo", 480, 0],
      [ID, "Capture du tableau de bord", 480, 2],
    ]);
  });

  it("names every entry that shows an image", async () => {
    await repository().create(image());
    const projectId = await insertProject(testDb.db, {
      slug: "demo",
      coverMediaId: ID,
    });
    const experienceId = await insertExperience(testDb.db, {
      slug: "acme",
      company: "Acme",
      logoMediaId: ID,
    });
    const [certification] = await testDb.db
      .insert(certifications)
      .values({
        slug: "oscp",
        name: "OSCP",
        issuer: "OffSec",
        issuedOn: "2024-03-01",
        badgeMediaId: ID,
      })
      .returning({ id: certifications.id });

    const found = await repository().find(ID);

    expect(found.ok && found.data?.usages).toEqual([
      { kind: "project", id: projectId, label: "demo (fr)" },
      { kind: "experience", id: experienceId, label: "Acme" },
      { kind: "certification", id: certification?.id, label: "OSCP" },
    ]);
  });

  it("changes the alternative texts, or says the image is gone", async () => {
    await repository().create(image());

    expect(
      await repository().updateAlt(ID, { fr: "Tableau", en: "Board" }),
    ).toEqual(ok({ status: "saved", id: ID, isNew: false }));
    const found = await repository().find(ID);
    expect(found.ok && found.data?.alt).toEqual({ fr: "Tableau", en: "Board" });
    expect(await repository().updateAlt(OTHER, { fr: "x", en: "y" })).toEqual(
      ok({ status: "not_found" }),
    );
  });

  it("offers the images to pick from, by their French text", async () => {
    await repository().create(image());

    expect(await repository().options()).toEqual(
      ok([
        {
          id: ID,
          alt: "Capture du tableau de bord",
          thumbnail: image().variants[0],
        },
      ]),
    );
  });
});
