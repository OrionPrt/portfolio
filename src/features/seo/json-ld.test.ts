import { describe, expect, it } from "vitest";

import {
  personJsonLd,
  postJsonLd,
  projectJsonLd,
  serializeJsonLd,
} from "./json-ld";

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

describe("postJsonLd", () => {
  const POST = {
    headline: "Pwning a box",
    description: "How it fell.",
    url: "https://orion.dev/en/blog/a-box",
    language: "en" as const,
    datePublished: "2026-10-30",
    authorName: "Orion",
    keywords: ["Rust", "Linux"],
    image: undefined,
  };

  it("describes a blog post, its page, day and author", () => {
    expect(postJsonLd(POST)).toEqual({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: "Pwning a box",
      description: "How it fell.",
      url: "https://orion.dev/en/blog/a-box",
      mainEntityOfPage: "https://orion.dev/en/blog/a-box",
      inLanguage: "en",
      datePublished: "2026-10-30",
      author: { "@type": "Person", name: "Orion" },
      keywords: "Rust, Linux",
    });
  });

  it("names its cover when it has one", () => {
    expect(
      postJsonLd({ ...POST, image: "https://s.blob.example/c.webp" }),
    ).toMatchObject({ image: "https://s.blob.example/c.webp" });
  });
});
