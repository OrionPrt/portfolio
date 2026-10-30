import type { SocialLinkView } from "@/features/profile/repository";
import type { Locale } from "@/i18n/locales";

type JsonLd = Readonly<Record<string, unknown>>;

const SCHEMA_ORG = "https://schema.org";

// Characters that could end the <script> element or break a JS parser.
const UNSAFE_IN_SCRIPT: Readonly<Record<string, string>> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/**
 * JSON for a <script type="application/ld+json">: stored text could contain
 * "</script>", so every character that could close the element is escaped.
 */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(
    /[<>&\u2028\u2029]/g,
    (character) => UNSAFE_IN_SCRIPT[character] ?? character,
  );
}

interface PersonInput {
  readonly name: string;
  readonly jobTitle: string;
  readonly description: string;
  readonly url: string;
  readonly links: readonly SocialLinkView[];
}

export function personJsonLd(person: PersonInput): JsonLd {
  return {
    "@context": SCHEMA_ORG,
    "@type": "Person",
    name: person.name,
    jobTitle: person.jobTitle,
    description: person.description,
    url: person.url,
    sameAs: person.links
      .filter((link) => link.url.startsWith("https://"))
      .map((link) => link.url),
  };
}

interface ProjectInput {
  readonly name: string;
  readonly description: string;
  readonly url: string;
  readonly language: Locale;
  readonly authorName: string;
  readonly keywords: readonly string[];
  readonly repoUrl: string | null;
}

/** A project; SoftwareSourceCode (a CreativeWork) when its code is public. */
export function projectJsonLd(project: ProjectInput): JsonLd {
  return {
    "@context": SCHEMA_ORG,
    "@type": project.repoUrl === null ? "CreativeWork" : "SoftwareSourceCode",
    name: project.name,
    description: project.description,
    url: project.url,
    inLanguage: project.language,
    author: { "@type": "Person", name: project.authorName },
    keywords: project.keywords.join(", "),
    ...(project.repoUrl === null ? {} : { codeRepository: project.repoUrl }),
  };
}
