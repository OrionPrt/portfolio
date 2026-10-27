import { describe, expect, it } from "vitest";

import {
  certificationInputSchema,
  educationInputSchema,
  experienceInputSchema,
  httpsUrlSchema,
  isoDateSchema,
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
  it.each(["2024-13-01", "01/02/2024", "2024-02-30T00:00:00Z"])(
    "rejects %j",
    (value) => {
      expect(isoDateSchema.safeParse(value).success).toBe(false);
    },
  );
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
