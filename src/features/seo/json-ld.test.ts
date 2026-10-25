import { describe, expect, it } from "vitest";

import { personJsonLd, projectJsonLd, serializeJsonLd } from "./json-ld";

describe("serializeJsonLd", () => {
  it("cannot close the script element it is written into", () => {
    const json = serializeJsonLd({
      name: "</script><script>alert(1)</script>",
    });

    expect(json).not.toContain("<");
    expect(JSON.parse(json)).toEqual({
      name: "</script><script>alert(1)</script>",
    });
  });
});

describe("personJsonLd", () => {
  it("describes the owner, with their https profiles only", () => {
    expect(
      personJsonLd({
        name: "Orion",
        jobTitle: "Ingénieur logiciel",
        description: "Pitch",
        url: "https://orion.dev/fr",
        links: [
          { kind: "github", url: "https://github.com/OrionPrt" },
          { kind: "email", url: "mailto:me@example.com" },
        ],
      }),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Orion",
      jobTitle: "Ingénieur logiciel",
      description: "Pitch",
      url: "https://orion.dev/fr",
      sameAs: ["https://github.com/OrionPrt"],
    });
  });
});

describe("projectJsonLd", () => {
  it("describes a project with source code as SoftwareSourceCode", () => {
    expect(
      projectJsonLd({
        name: "Ce portfolio",
        description: "Un site",
        url: "https://orion.dev/fr/projets/portfolio",
        language: "fr",
        authorName: "Orion",
        keywords: ["Next.js", "TypeScript"],
        repoUrl: "https://github.com/OrionPrt/portfolio",
      }),
    ).toMatchObject({
      "@type": "SoftwareSourceCode",
      inLanguage: "fr",
      author: { "@type": "Person", name: "Orion" },
      keywords: "Next.js, TypeScript",
      codeRepository: "https://github.com/OrionPrt/portfolio",
    });
  });

  it("falls back to CreativeWork without a repository", () => {
    const schema = projectJsonLd({
      name: "Audit",
      description: "Un audit",
      url: "https://orion.dev/fr/projets/audit",
      language: "fr",
      authorName: "Orion",
      keywords: [],
      repoUrl: null,
    });

    expect(schema["@type"]).toBe("CreativeWork");
    expect(schema).not.toHaveProperty("codeRepository");
  });
});
