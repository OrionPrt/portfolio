import {
  experiences,
  experienceSkills,
  experienceTranslations,
  projects,
  projectSkills,
  projectTranslations,
  skills,
} from "@/db/schema";
import type { Database } from "@/db/types";
import type { Locale } from "@/i18n/locales";

type ProjectInsert = typeof projects.$inferInsert;
type ExperienceInsert = typeof experiences.$inferInsert;

function summary(locale: Locale, label: string) {
  return {
    summaryContext: `${label} context (${locale})`,
    summaryAction: `${label} action (${locale})`,
    summaryResult: `${label} result (${locale})`,
  };
}

export async function insertSkill(
  db: Database,
  slug: string,
  domain: "web" | "low_level" | "devops" | "cyber" = "web",
): Promise<string> {
  const [row] = await db
    .insert(skills)
    .values({ slug, name: slug.toUpperCase(), domain })
    .returning({ id: skills.id });
  return row?.id ?? "";
}

/** A project with a translation per given locale, linked to the given skill ids. */
export async function insertProject(
  db: Database,
  values: Partial<ProjectInsert> & { slug: string },
  locales: readonly Locale[] = ["fr", "en"],
  skillIds: readonly string[] = [],
): Promise<string> {
  const [row] = await db
    .insert(projects)
    .values({ domain: "web", status: "published", ...values })
    .returning({ id: projects.id });
  const projectId = row?.id ?? "";
  if (locales.length > 0) {
    await db.insert(projectTranslations).values(
      locales.map((locale) => ({
        projectId,
        locale,
        title: `${values.slug} (${locale})`,
        tagline: `tagline (${locale})`,
        ...summary(locale, values.slug),
      })),
    );
  }
  if (skillIds.length > 0) {
    await db.insert(projectSkills).values(
      skillIds.map((skillId, sortOrder) => ({
        projectId,
        skillId,
        sortOrder,
      })),
    );
  }
  return projectId;
}

export async function insertExperience(
  db: Database,
  values: Partial<ExperienceInsert> & { slug: string },
  locales: readonly Locale[] = ["fr", "en"],
  skillIds: readonly string[] = [],
): Promise<string> {
  const [row] = await db
    .insert(experiences)
    .values({
      company: `${values.slug} company`,
      employmentType: "full_time",
      status: "published",
      startedOn: "2024-01-01",
      ...values,
    })
    .returning({ id: experiences.id });
  const experienceId = row?.id ?? "";
  if (locales.length > 0) {
    await db.insert(experienceTranslations).values(
      locales.map((locale) => ({
        experienceId,
        locale,
        role: `${values.slug} role (${locale})`,
        ...summary(locale, values.slug),
      })),
    );
  }
  if (skillIds.length > 0) {
    await db.insert(experienceSkills).values(
      skillIds.map((skillId, sortOrder) => ({
        experienceId,
        skillId,
        sortOrder,
      })),
    );
  }
  return experienceId;
}
