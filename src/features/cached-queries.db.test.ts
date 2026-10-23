import { cacheLife, cacheTag } from "next/cache";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { withDatabase } from "@/db/client";
import type { Database } from "@/db/types";
import { err, type Result } from "@/lib/result";

import { createTestDatabase, type TestDatabase } from "../../test/db";
import { insertExperience, insertProject } from "../../test/fixtures/content";
import * as catalog from "./catalog/queries";
import * as experiences from "./experiences/queries";
import * as profile from "./profile/queries";
import * as projects from "./projects/queries";

const database = vi.hoisted(() => ({
  current: undefined as Database | undefined,
}));

// Outside Next.js, the cache APIs only need to be observed.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/db/client", () => ({
  withDatabase: vi.fn((read: (db: Database) => Promise<unknown>) => {
    if (database.current === undefined) {
      throw new Error("The test database is not ready.");
    }
    return read(database.current);
  }),
}));

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
  database.current = testDb.db;
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  vi.clearAllMocks();
  await testDb.reset();
});

type CachedRead = () => Promise<Result<unknown>>;

// The tag table: what each read is tagged with, so the admin (P6) can revalidate it.
const READS: readonly [string, CachedRead, readonly string[]][] = [
  ["getProfile", () => profile.getProfile("fr"), ["profile"]],
  [
    "getPublishedProjects",
    () => projects.getPublishedProjects("fr"),
    ["projects", "skills"],
  ],
  [
    "getFeaturedProject",
    () => projects.getFeaturedProject("fr"),
    ["projects", "skills"],
  ],
  [
    "getPublishedProjectSlugs",
    () => projects.getPublishedProjectSlugs(),
    ["projects"],
  ],
  [
    "getPublishedExperiences",
    () => experiences.getPublishedExperiences("fr"),
    ["experiences", "skills"],
  ],
  [
    "getCurrentExperience",
    () => experiences.getCurrentExperience("fr"),
    ["experiences", "skills"],
  ],
  [
    "getPublishedExperienceSlugs",
    () => experiences.getPublishedExperienceSlugs(),
    ["experiences"],
  ],
  ["getSkills", () => catalog.getSkills(), ["skills"]],
  ["getEducation", () => catalog.getEducation("fr"), ["education"]],
  [
    "getCertifications",
    () => catalog.getCertifications("fr"),
    ["certifications"],
  ],
  ["getBentoTiles", () => catalog.getBentoTiles(), ["bento"]],
];

describe.each(READS)("%s", (_name, read, tags) => {
  it("tags its entry and keeps a successful read for hours", async () => {
    const result = await read();

    expect(result.ok).toBe(true);
    expect(cacheTag).toHaveBeenCalledExactlyOnceWith(...tags);
    expect(cacheLife).toHaveBeenCalledExactlyOnceWith("hours");
  });

  it("keeps a failed read for seconds only, so an outage is not cached", async () => {
    vi.mocked(withDatabase).mockResolvedValueOnce(
      err({ code: "DB_UNAVAILABLE", message: "down" }),
    );

    const result = await read();

    expect(result.ok).toBe(false);
    expect(cacheLife).toHaveBeenCalledExactlyOnceWith("seconds");
  });
});

interface SlugRead {
  readonly kind: string;
  readonly insert: (slug: string) => Promise<string>;
  readonly read: (slug: string) => Promise<Result<unknown>>;
  readonly listTag: string;
  readonly entityTag: (slug: string) => string;
}

const SLUG_READS: readonly SlugRead[] = [
  {
    kind: "project",
    insert: (slug) => insertProject(testDb.db, { slug }),
    read: (slug) => projects.getPublishedProject(slug, "en"),
    listTag: "projects",
    entityTag: (slug) => `project:${slug}`,
  },
  {
    kind: "experience",
    insert: (slug) => insertExperience(testDb.db, { slug }),
    read: (slug) => experiences.getPublishedExperience(slug, "en"),
    listTag: "experiences",
    entityTag: (slug) => `experience:${slug}`,
  },
];

describe.each(SLUG_READS)("reading one $kind", (entity) => {
  it("checks the cached slug list first, then reads the entry tagged with its slug", async () => {
    await entity.insert("demo");

    const result = await entity.read("demo");

    expect(result.ok && result.data).toMatchObject({ slug: "demo" });
    expect(vi.mocked(cacheTag).mock.calls).toEqual([
      [entity.listTag],
      [entity.entityTag("demo"), "skills"],
    ]);
  });

  it("answers an unknown slug from the slug list, without a query or entry of its own", async () => {
    const result = await entity.read("ghost");

    expect(result).toEqual({ ok: true, data: undefined });
    expect(withDatabase).toHaveBeenCalledOnce();
    expect(vi.mocked(cacheTag).mock.calls).toEqual([[entity.listTag]]);
  });

  it("passes on a failed slug list, kept for seconds only", async () => {
    vi.mocked(withDatabase).mockResolvedValueOnce(
      err({ code: "DB_UNAVAILABLE", message: "down" }),
    );

    const result = await entity.read("demo");

    expect(result.ok).toBe(false);
    expect(cacheLife).toHaveBeenCalledExactlyOnceWith("seconds");
  });

  it("keeps a failed entry read for seconds only, after a good slug list", async () => {
    await entity.insert("demo");
    vi.mocked(withDatabase)
      .mockImplementationOnce((read) => read(testDb.db))
      .mockResolvedValueOnce(err({ code: "DB_UNAVAILABLE", message: "down" }));

    const result = await entity.read("demo");

    expect(result.ok).toBe(false);
    expect(vi.mocked(cacheLife).mock.calls).toEqual([["hours"], ["seconds"]]);
  });

  it.each(["../etc", "Demo", "a".repeat(81)])(
    "answers the malformed slug %j without a query or a cache entry",
    async (slug) => {
      expect(await entity.read(slug)).toEqual({ ok: true, data: undefined });
      expect(withDatabase).not.toHaveBeenCalled();
      expect(cacheTag).not.toHaveBeenCalled();
    },
  );
});
