import type { ExperienceView } from "@/features/experiences/repository";
import type { ProfileView } from "@/features/profile/repository";
import type { ProjectView } from "@/features/projects/types";

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
    isFallback: false,
    contentLocale: "fr",
    ...overrides,
  };
}
