import { describe, expect, it } from "vitest";

import {
  certificationContentSchema,
  certificationInputSchema,
  educationContentSchema,
  educationInputSchema,
  experienceInputSchema,
  httpsUrlSchema,
  isoDateSchema,
  postInputSchema,
  projectInputSchema,
  slugSchema,
  socialLinkInputSchema,
  socialUrlSchema,
  TEXT_LIMITS,
} from "./schemas";

const SUMMARY = {
  summaryContext: "Context",
  summaryAction: "Action",
  summaryResult: "Result",
};

function project(overrides: Record<string, unknown> = {}) {
  return {
    slug: "demo",
    domain: "web",
    translations: { fr: { title: "Démo", tagline: "Accroche", ...SUMMARY } },
    ...overrides,
  };
}

describe("slugSchema", () => {
  it.each(["demo", "my-project-2"])("accepts %j", (value) => {
    expect(slugSchema.safeParse(value).success).toBe(true);
  });

  it.each(["", "Demo", "demo project", "démo", "a".repeat(81)])(
    "rejects %j",
    (value) => {
      expect(slugSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("URL schemas", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,x",
    "http://example.com",
    "//example.com",
    "not a url",
  ])("reject the unsafe or malformed link %j", (value) => {
    expect(httpsUrlSchema.safeParse(value).success).toBe(false);
    expect(socialUrlSchema.safeParse(value).success).toBe(false);
  });

  it("accept https, and mailto for social links only", () => {
    expect(httpsUrlSchema.safeParse("https://github.com/x").success).toBe(true);
    expect(socialUrlSchema.safeParse("mailto:me@example.com").success).toBe(
      true,
    );
    expect(httpsUrlSchema.safeParse("mailto:me@example.com").success).toBe(
      false,
    );
  });

  it.each([
    "mailto:me@example.com?subject=x&body=y",
    "mailto:me@example.com?bcc=x%40y.com",
    "mailto:me@example.com#x",
  ])("reject a mailto link that would fill in a message: %j", (value) => {
    expect(socialUrlSchema.safeParse(value).success).toBe(false);
  });

  it("normalizes a link before checking it, as the database stores it", () => {
    expect(httpsUrlSchema.parse("HTTPS://Example.com")).toBe(
      "https://example.com/",
    );
    expect(httpsUrlSchema.parse(" https://example.com/x ")).toBe(
      "https://example.com/x",
    );
  });

  it.each(["https://user:pw@evil.example", "MAILTO:a@b.co", "mailto:"])(
    "rejects the disguised or empty link %j",
    (value) => {
      expect(socialUrlSchema.safeParse(value).success).toBe(false);
    },
  );

  it("caps the length of a link", () => {
    const long = `https://example.com/${"a".repeat(TEXT_LIMITS.url)}`;

    expect(httpsUrlSchema.safeParse(long).success).toBe(false);
  });
});

describe("socialLinkInputSchema", () => {
  it.each([
    ["email", "mailto:hello@example.com", true],
    ["email", "https://example.com", false],
    ["github", "https://github.com/OrionPrt", true],
    ["github", "mailto:hello@example.com", false],
  ] as const)("%s link %j is valid → %s", (kind, url, valid) => {
    expect(socialLinkInputSchema.safeParse({ kind, url }).success).toBe(valid);
  });
});

describe("isoDateSchema", () => {
  it.each(["1900-01-01", "2024-02-29", "2999-12-31"])("accepts %j", (value) => {
    expect(isoDateSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    "2024-13-01",
    "01/02/2024",
    "2024-02-30T00:00:00Z",
    // Postgres has no year 0; nothing here predates 1900 or follows 2999.
    "0000-01-01",
    "1899-12-31",
    "3000-01-01",
  ])("rejects %j", (value) => {
    expect(isoDateSchema.safeParse(value).success).toBe(false);
  });
});

describe("projectInputSchema", () => {
  it("fills the defaults of an optional field with an explicit value", () => {
    const parsed = projectInputSchema.parse(project());

    expect(parsed).toMatchObject({
      status: "draft",
      featured: false,
      sortOrder: 0,
      repoUrl: null,
      startedOn: null,
      skills: [],
    });
    expect(parsed.translations.fr).toMatchObject({
      technicalMd: "",
      seoDescription: null,
    });
  });

  it("trims text and rejects text left empty", () => {
    const blank = project({
      translations: { fr: { title: "   ", tagline: "x", ...SUMMARY } },
    });

    expect(projectInputSchema.safeParse(blank).success).toBe(false);
    expect(
      projectInputSchema.parse(
        project({
          translations: { fr: { title: " Démo ", tagline: "x", ...SUMMARY } },
        }),
      ).translations.fr?.title,
    ).toBe("Démo");
  });

  it("caps the length of a title", () => {
    const long = project({
      translations: {
        fr: {
          title: "a".repeat(TEXT_LIMITS.title + 1),
          tagline: "x",
          ...SUMMARY,
        },
      },
    });

    expect(projectInputSchema.safeParse(long).success).toBe(false);
  });

  it("requires the default locale and only known locales", () => {
    const english = { title: "Demo", tagline: "Tagline", ...SUMMARY };

    expect(
      projectInputSchema.safeParse(project({ translations: { en: english } }))
        .success,
    ).toBe(false);
    expect(
      projectInputSchema.safeParse(
        project({
          translations: { fr: english, de: english },
        }),
      ).success,
    ).toBe(false);
  });

  it.each([
    [{ startedOn: "2024-05-01", endedOn: "2024-04-30" }, false],
    [{ startedOn: "2024-05-01", endedOn: "2024-05-01" }, true],
    [{ endedOn: "2024-05-01" }, false],
    [{ startedOn: "2024-05-01" }, true],
  ])("orders its dates: %j is valid → %s", (dates, valid) => {
    expect(projectInputSchema.safeParse(project(dates)).success).toBe(valid);
  });

  it("rejects a skill listed twice", () => {
    expect(
      projectInputSchema.safeParse(project({ skills: ["react", "react"] }))
        .success,
    ).toBe(false);
  });
});

describe("experienceInputSchema", () => {
  const experience = {
    slug: "acme",
    company: "Acme",
    employmentType: "full_time",
    startedOn: "2024-01-01",
    translations: { fr: { role: "Développeur", ...SUMMARY } },
  };

  it("treats a missing end date as the current position", () => {
    expect(experienceInputSchema.parse(experience).endedOn).toBeNull();
  });

  it("rejects an end before the start", () => {
    expect(
      experienceInputSchema.safeParse({ ...experience, endedOn: "2023-12-31" })
        .success,
    ).toBe(false);
  });
});

describe("the admin's education and certification content", () => {
  const EDUCATION = {
    school: "INSA",
    startedOn: "2020-09-01",
    translations: { fr: { degree: "Ingénieur" } },
  };
  const CERTIFICATION = {
    name: "OSCP",
    issuer: "OffSec",
    issuedOn: "2024-03-01",
    translations: { fr: {} },
  };

  it("needs no slug: one is drawn from the name at creation", () => {
    expect(educationContentSchema.safeParse(EDUCATION).success).toBe(true);
    expect(certificationContentSchema.safeParse(CERTIFICATION).success).toBe(
      true,
    );
    expect(educationInputSchema.safeParse(EDUCATION).success).toBe(false);
  });

  it("keeps the date rules, on the end date", () => {
    expect(
      educationContentSchema.safeParse({ ...EDUCATION, endedOn: "2019-01-01" })
        .error?.issues[0]?.path,
    ).toEqual(["endedOn"]);
    expect(
      certificationContentSchema.safeParse({
        ...CERTIFICATION,
        expiresOn: "2024-01-01",
      }).error?.issues[0]?.path,
    ).toEqual(["expiresOn"]);
  });
});

describe("date order", () => {
  it.each([
    [
      "a project",
      projectInputSchema,
      project({ startedOn: "2024-05-01", endedOn: "2024-04-30" }),
      "endedOn",
    ],
    [
      "an experience",
      experienceInputSchema,
      {
        slug: "acme",
        company: "Acme",
        employmentType: "full_time",
        startedOn: "2024-01-01",
        endedOn: "2023-12-31",
        translations: { fr: { role: "Développeur", ...SUMMARY } },
      },
      "endedOn",
    ],
    [
      "an education",
      educationInputSchema,
      {
        slug: "insa",
        school: "INSA",
        startedOn: "2020-09-01",
        endedOn: "2020-06-30",
        translations: { fr: { degree: "Ingénieur" } },
      },
      "endedOn",
    ],
    [
      "a certification",
      certificationInputSchema,
      {
        slug: "oscp",
        name: "OSCP",
        issuer: "OffSec",
        issuedOn: "2024-03-01",
        expiresOn: "2024-02-01",
        translations: { fr: {} },
      },
      "expiresOn",
    ],
  ] as const)(
    "puts %s's dates out of order on its end date, where the form shows it",
    (_, schema, input, field) => {
      const result = schema.safeParse(input);

      expect(result.error?.issues.map((issue) => issue.path)).toEqual([
        [field],
      ]);
    },
  );
});

describe("postInputSchema", () => {
  const ENGLISH = {
    title: "Pwning a box",
    excerpt: "How it fell.",
    bodyMd: "## Recon\n\nNmap first.",
  };

  function post(overrides: Record<string, unknown> = {}) {
    return { slug: "a-box", translations: { en: ENGLISH }, ...overrides };
  }

  function problems(input: unknown) {
    const parsed = postInputSchema.safeParse(input);
    return parsed.success
      ? []
      : parsed.error.issues.map((issue) => issue.path.join("."));
  }

  it("takes a post in one language, any of them", () => {
    expect(postInputSchema.safeParse(post()).success).toBe(true);
    expect(
      postInputSchema.safeParse(post({ translations: { fr: ENGLISH } }))
        .success,
    ).toBe(true);
  });

  it("refuses a post without any language, under one name", () => {
    expect(problems(post({ translations: {} }))).toEqual([
      "translations.language",
    ]);
  });

  it("needs a body and an excerpt in each language given", () => {
    expect(
      problems(post({ translations: { en: { ...ENGLISH, bodyMd: " " } } })),
    ).toEqual(["translations.en.bodyMd"]);
  });

  it("dates a published post", () => {
    expect(problems(post({ status: "published" }))).toEqual(["publishedOn"]);
    expect(
      problems(post({ status: "published", publishedOn: "2026-10-30" })),
    ).toEqual([]);
  });

  it("names a write-up's platform", () => {
    expect(problems(post({ kind: "writeup" }))).toEqual(["platform"]);
  });

  it("keeps a live challenge's write-up unpublished, unless it is retired or allowed", () => {
    const published = {
      kind: "writeup",
      platform: "hackthebox",
      status: "published",
      publishedOn: "2026-10-30",
    };

    expect(problems(post(published))).toEqual(["retiredOn"]);
    expect(problems(post({ ...published, retiredOn: "2026-09-01" }))).toEqual(
      [],
    );
    expect(problems(post({ ...published, isDisclosureAllowed: true }))).toEqual(
      [],
    );
  });

  it("drops a challenge's details from an article", () => {
    const parsed = postInputSchema.parse(
      post({
        kind: "article",
        platform: "rootme",
        difficulty: "hard",
        retiredOn: "2026-01-01",
        isDisclosureAllowed: true,
      }),
    );

    expect(parsed).toMatchObject({
      platform: null,
      difficulty: null,
      retiredOn: null,
      isDisclosureAllowed: false,
    });
  });
});
