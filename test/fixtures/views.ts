import type { ExperienceView } from "@/features/experiences/repository";
import type { ProfileView } from "@/features/profile/repository";
import type { ProjectView } from "@/features/projects/types";

/** An image of the library, as a page shows it. */
export const COVER = {
  alt: "Le tableau de bord du portfolio",
  width: 960,
  height: 540,
  variants: [
    { width: 480, height: 270, url: "/api/media/media/c/480.webp", bytes: 1 },
    { width: 960, height: 540, url: "/api/media/media/c/960.webp", bytes: 2 },
  ],
};

const SUMMARY = {
  context: "Le contexte.",
  action: "L'action.",
  result: "Le résultat.",
};

export function profileView(overrides: Partial<ProfileView> = {}): ProfileView {
  return {
    displayName: "Orion",
    location: null,
    headline: "Ingénieur logiciel",
    availability: "Disponible",
    pitch: "Mon accroche.",
    aboutMd: "",
    lookingFor: null,
    socialLinks: [],
    isFallback: false,
    contentLocale: "fr",
    ...overrides,
  };
}

export function projectView(overrides: Partial<ProjectView> = {}): ProjectView {
  return {
    slug: "portfolio",
    domain: "web",
    featured: true,
    repoUrl: null,
    demoUrl: null,
    startedOn: null,
    endedOn: null,
    title: "Ce portfolio",
    tagline: "Un site bilingue.",
    summary: SUMMARY,
    technicalMd: "",
    seoDescription: null,
    skills: [],
    cover: undefined,
    isFallback: false,
    contentLocale: "fr",
    ...overrides,
  };
}

export function experienceView(
  overrides: Partial<ExperienceView> = {},
): ExperienceView {
  return {
    slug: "acme",
    company: "Acme",
    companyUrl: null,
    location: null,
    employmentType: "apprenticeship",
    startedOn: "2024-09-01",
    endedOn: null,
    isCurrent: true,
    role: "Développeur",
    summary: SUMMARY,
    technicalMd: "",
    skills: [],
    logo: undefined,
    isFallback: false,
    contentLocale: "fr",
    ...overrides,
  };
}
