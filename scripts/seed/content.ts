import { PLACEHOLDER as TO_COMPLETE } from "@/db/seed/placeholders";
import type { SeedContentInput } from "@/db/seed/schema";
import type { SkillDomain } from "@/features/content/vocabulary";

/**
 * The site's starting content, written by `pnpm db:seed` (upsert by slug).
 *
 * Nothing here is invented: unknown text is marked "[À COMPLÉTER]", and entries
 * that need facts not known yet (dates, issuers) are left out, with a template
 * in comments. A missing English translation falls back to French on the site.
 *
 * The seed adds and updates, never deletes: renaming a slug here leaves the old
 * row in the database, still published, until it is removed there.
 */

type SkillEntry = readonly [slug: string, name: string, featured?: boolean];

/** Skills keep the order listed here within their domain. */
function domainSkills(domain: SkillDomain, entries: readonly SkillEntry[]) {
  return entries.map(([slug, name, featured = false], sortOrder) => ({
    slug,
    name,
    domain,
    featured,
    sortOrder,
  }));
}

export const SEED_CONTENT: SeedContentInput = {
  profile: {
    displayName: "Orion",
    location: null,
    translations: {
      fr: {
        headline: "Ingénieur logiciel — fullstack, DevOps et cybersécurité",
        availability: `Disponible — ${TO_COMPLETE} (type de poste)`,
        pitch: `${TO_COMPLETE} Ton accroche en une phrase : ce que tu apportes, et pour qui.`,
      },
      en: {
        headline: "Software engineer — full-stack, DevOps and security",
        availability: `Available — ${TO_COMPLETE} (role)`,
        pitch: `${TO_COMPLETE} Your one-sentence pitch: what you bring, and to whom.`,
      },
    },
  },

  socialLinks: [
    { kind: "email", url: "mailto:prieto.orion@gmail.com", sortOrder: 0 },
    {
      kind: "linkedin",
      url: "https://linkedin.com/in/orion-prieto-aa4841342/",
      sortOrder: 1,
    },
    { kind: "github", url: "https://github.com/OrionPrt", sortOrder: 2 },
    // The platforms tile appears once one of these profiles exists.
    // { kind: "hackthebox", url: "https://app.hackthebox.com/profile/…", sortOrder: 3 },
    // { kind: "rootme", url: "https://www.root-me.org/…", sortOrder: 4 },
    // { kind: "tryhackme", url: "https://tryhackme.com/p/…", sortOrder: 5 },
  ],

  skills: [
    ...domainSkills("web", [
      ["typescript", "TypeScript", true],
      ["react", "React"],
      ["nextjs", "Next.js", true],
      ["angular", "Angular"],
      ["nestjs", "NestJS"],
      ["csharp-dotnet", "C# (.NET)"],
      ["java", "Java"],
      ["postgresql", "PostgreSQL"],
      ["html", "HTML"],
      ["css", "CSS"],
    ]),
    ...domainSkills("low_level", [
      ["c", "C", true],
      ["cpp", "C++"],
      ["rust", "Rust", true],
      ["haskell", "Haskell"],
      ["python", "Python"],
    ]),
    ...domainSkills("devops", [
      ["docker", "Docker", true],
      ["github-actions", "GitHub Actions", true],
      ["github", "GitHub"],
    ]),
    ...domainSkills("cyber", [
      ["binary-exploitation", "Binary exploitation (C/C++)", true],
      ["web-security", "Web security"],
      ["active-directory", "Active Directory", true],
      ["kerberos", "Kerberos"],
      ["netexec", "NetExec"],
      ["godpotato", "GodPotato"],
      ["osint", "OSINT"],
    ]),
  ],

  projects: [
    {
      slug: "portfolio",
      domain: "web",
      status: "published",
      featured: true,
      repoUrl: "https://github.com/OrionPrt/portfolio",
      skills: ["nextjs", "typescript", "react", "postgresql", "github-actions"],
      translations: {
        fr: {
          title: "Ce portfolio",
          tagline:
            "Un site bilingue dont le code et la chaîne DevSecOps servent eux-mêmes de preuve.",
          summaryContext:
            "Un portfolio doit convaincre un recruteur en quelques secondes, et un ingénieur en quelques minutes.",
          summaryAction:
            "Conception et développement d'un site Next.js bilingue : accueil en grille bento, deux niveaux de lecture, sécurité et tests automatisés dès le premier commit.",
          summaryResult:
            "Un site public et open source, vérifié automatiquement à chaque modification.",
          technicalMd: [
            "- **Stack** : Next.js 16 (App Router, Cache Components), React 19, TypeScript strict, Tailwind 4, next-intl.",
            "- **Données** : PostgreSQL sur Neon via Drizzle, migrations versionnées, lectures en cache taguées.",
            "- **Sécurité** : CSP à nonce par requête, en-têtes stricts, variables d'environnement validées, journaux sans secrets.",
            "- **CI** : lint, types, tests Vitest et Playwright avec axe, puis gitleaks, CodeQL et OSV-Scanner ; actions épinglées par SHA.",
          ].join("\n"),
        },
        en: {
          title: "This portfolio",
          tagline:
            "A bilingual site whose code and DevSecOps pipeline are themselves the proof.",
          summaryContext:
            "A portfolio has seconds to convince a recruiter, and minutes to convince an engineer.",
          summaryAction:
            "Designed and built a bilingual Next.js site: a bento-grid home, two reading levels, security and automated tests from the first commit.",
          summaryResult:
            "A public, open-source site, checked automatically on every change.",
          technicalMd: [
            "- **Stack**: Next.js 16 (App Router, Cache Components), React 19, strict TypeScript, Tailwind 4, next-intl.",
            "- **Data**: PostgreSQL on Neon through Drizzle, versioned migrations, tagged cached reads.",
            "- **Security**: per-request nonce CSP, strict headers, validated environment, secret-free logs.",
            "- **CI**: lint, types, Vitest and Playwright tests with axe, then gitleaks, CodeQL and OSV-Scanner; actions pinned by SHA.",
          ].join("\n"),
        },
      },
    },
  ],

  // Template (the slug is the key the seed upserts by):
  // {
  //   slug: "company-role",
  //   company: "…",
  //   employmentType: "full_time", // part_time, internship, apprenticeship, freelance
  //   status: "published",
  //   startedOn: "YYYY-MM-DD",
  //   endedOn: null, // null while the position is current
  //   skills: ["typescript"],
  //   translations: {
  //     fr: { role: "…", summaryContext: "…", summaryAction: "…", summaryResult: "…" },
  //   },
  // },
  experiences: [],

  // Template: { slug: "school-degree", school: "…", startedOn: "YYYY-MM-DD",
  //   endedOn: "YYYY-MM-DD", translations: { fr: { degree: "…" } } },
  education: [],

  // Template: { slug: "oscp", name: "…", issuer: "…", issuedOn: "YYYY-MM-DD",
  //   verifyUrl: "https://…", translations: { fr: { description: "…" } } },
  certifications: [],

  // The home hub, in reading order. Sizes: sm 1×1, md 2×1, lg 1×2, xl 2×2 on a
  // four-column grid. A tile without content hides itself: the experience
  // tile without a current position, the journey tile without education or
  // certification, the platforms tile without a profile. The CV stays hidden
  // until it is generated (P9).
  tiles: [
    { kind: "identity", size: "xl", sortOrder: 0 },
    { kind: "featured_project", size: "xl", sortOrder: 1 },
    { kind: "current_experience", size: "sm", sortOrder: 2 },
    { kind: "stack", size: "md", sortOrder: 3 },
    { kind: "cyber_stats", size: "sm", sortOrder: 4 },
    { kind: "certifications", size: "sm", sortOrder: 5 },
    { kind: "cv", size: "sm", sortOrder: 6, visible: false },
    { kind: "contact", size: "sm", sortOrder: 7 },
  ],
};
