import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MAX_SLUGS } from "@/db/limits";
import { skills } from "@/db/schema";
import { createRedirectsRepository } from "@/features/content/redirects-repository";
import type { ProjectInput } from "@/features/content/schemas";
import { ok } from "@/lib/result";

import { createTestDatabase, type TestDatabase } from "../../../test/db";
import { createProjectsAdminRepository } from "./admin-repository";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  await testDb.db.insert(skills).values([
    { slug: "react", name: "React", domain: "web" },
    { slug: "rust", name: "Rust", domain: "low_level" },
    { slug: "docker", name: "Docker", domain: "devops" },
  ]);
});

const FRENCH = {
  title: "Démo",
  tagline: "Accroche",
  summaryContext: "Contexte",
  summaryAction: "Action",
  summaryResult: "Résultat",
  technicalMd: "",
  seoDescription: null,
};

const ENGLISH = {
  ...FRENCH,
  title: "Demo",
  tagline: "Tagline",
  summaryContext: "Context",
  summaryResult: "Result",
};

function input(overrides: Partial<ProjectInput> = {}): ProjectInput {
  return {
    slug: "demo",
    domain: "web",
    status: "draft",
    featured: false,
    sortOrder: 0,
    repoUrl: null,
    demoUrl: null,
    coverMediaId: null,
    startedOn: null,
    endedOn: null,
    skills: [],
    translations: { fr: FRENCH },
    ...overrides,
  };
}

function repository() {
  return createProjectsAdminRepository(testDb.db);
}

async function created(overrides: Partial<ProjectInput> = {}) {
  const outcome = await repository().create(input(overrides));
  if (!outcome.ok || outcome.data.status !== "saved") {
    throw new Error("Not created");
  }
  return outcome.data.id;
}

async function redirects() {
  const listed = await createRedirectsRepository(testDb.db).list();
  return listed.ok
    ? listed.data.map(({ fromSlug, toSlug }) => [fromSlug, toSlug])
    : [];
}

describe("projects admin repository", () => {
  it("creates a project with its languages and skills in order, and finds it", async () => {
    const outcome = await repository().create(
      input({
        repoUrl: "https://github.com/orion/demo",
        startedOn: "2024-01-01",
        skills: ["rust", "gone", "react"],
        translations: { fr: FRENCH, en: ENGLISH },
      }),
    );
    if (!outcome.ok || outcome.data.status !== "saved") {
      throw new Error("Not created");
    }
    const { id } = outcome.data;

    expect(outcome.data).toEqual({
      status: "saved",
      id,
      isNew: true,
      slugs: ["demo"],
    });
    expect(await repository().find(id)).toEqual(
      ok({
        ...input({
          repoUrl: "https://github.com/orion/demo",
          startedOn: "2024-01-01",
          skills: ["rust", "react"],
          translations: { fr: FRENCH, en: ENGLISH },
        }),
        id,
      }),
    );
  });

  it("refuses a slug another project holds, and a project past the slug listings", async () => {
    await created();

    expect(await repository().create(input({ status: "published" }))).toEqual(
      ok({ status: "conflict", field: "slug" }),
    );

    await testDb.exec(
      `insert into projects (slug, domain) select 'p-' || n, 'web' from generate_series(2, ${String(MAX_SLUGS)}) as n`,
    );
    expect(await repository().create(input({ slug: "one-more" }))).toEqual(
      ok({ status: "full" }),
    );
  });

  it("lists the featured projects first, each with its title and how far its English goes", async () => {
    await created({ slug: "plain" });
    await created({
      slug: "partial",
      translations: { fr: FRENCH, en: { ...ENGLISH, tagline: "" } },
    });
    await created({
      slug: "star",
      featured: true,
      status: "published",
      translations: { fr: { ...FRENCH, title: "Étoile" }, en: ENGLISH },
    });

    const listed = await repository().list();

    expect(
      listed.ok &&
        listed.data.map(({ slug, title, status, featured, english }) => [
          slug,
          title,
          status,
          featured,
          english,
        ]),
    ).toEqual([
      ["star", "Étoile", "published", true, "complete"],
      ["plain", "Démo", "draft", false, "missing"],
      ["partial", "Démo", "draft", false, "partial"],
    ]);
  });

  it("updates a project: its languages and skills become the ones sent", async () => {
    const id = await created({
      skills: ["react", "rust"],
      translations: { fr: FRENCH, en: ENGLISH },
    });

    const outcome = await repository().update(
      id,
      input({
        domain: "devops",
        skills: ["docker", "react"],
        translations: { fr: { ...FRENCH, title: "Nouveau" } },
      }),
    );

    expect(outcome).toEqual(
      ok({
        status: "saved",
        id,
        isNew: false,
        slugs: ["demo"],
        diff: {
          removedTranslations: [{ locale: "en", ...ENGLISH }],
        },
      }),
    );
    const found = await repository().find(id);
    expect(found.ok && found.data).toMatchObject({
      domain: "devops",
      skills: ["docker", "react"],
      translations: { fr: { title: "Nouveau" } },
    });
    expect(found.ok && found.data?.translations.en).toBeUndefined();
  });

  it("says when the slug is taken or the project is gone", async () => {
    const id = await created();
    await created({ slug: "other" });

    expect(await repository().update(id, input({ slug: "other" }))).toEqual(
      ok({ status: "conflict", field: "slug" }),
    );
    expect(
      await repository().update(
        "00000000-0000-4000-8000-000000000000",
        input(),
      ),
    ).toEqual(ok({ status: "not_found" }));
  });

  it("leads a published project's old slug to its new one; a draft's rename leaves none", async () => {
    const published = await created({ status: "published" });
    const draft = await created({ slug: "draft" });

    expect(
      await repository().update(
        published,
        input({ slug: "renamed", status: "published" }),
      ),
    ).toEqual(
      ok({
        status: "saved",
        id: published,
        isNew: false,
        slugs: ["renamed", "demo"],
      }),
    );
    await repository().update(draft, input({ slug: "draft-renamed" }));

    expect(await redirects()).toEqual([["demo", "renamed"]]);
  });

  it("takes an old slug back once published, not while a draft", async () => {
    const renamed = await created({ status: "published" });
    await repository().update(
      renamed,
      input({ slug: "renamed", status: "published" }),
    );

    const id = await created();
    expect(await redirects()).toEqual([["demo", "renamed"]]);

    await repository().update(id, input({ status: "published" }));
    expect(await redirects()).toEqual([]);
  });

  it("keeps each group's order: a project changing group goes to the end of the other", async () => {
    const first = await created({ slug: "first" });
    const second = await created({ slug: "second" });
    const star = await created({ slug: "star", featured: true });

    expect(await repository().siblings(first)).toEqual(ok([first, second]));
    expect(await repository().siblings(star)).toEqual(ok([star]));
    expect(await repository().reorder([second, first])).toEqual(ok(undefined));
    expect(await repository().siblings(first)).toEqual(ok([second, first]));

    await repository().update(
      second,
      input({ slug: "second", featured: true }),
    );
    expect(await repository().siblings(star)).toEqual(ok([star, second]));
  });
});
