import { eq } from "drizzle-orm";

import {
  bentoTiles,
  certifications,
  certificationTranslations,
  education,
  educationTranslations,
  experiences,
  experienceSkills,
  experienceTranslations,
  profile,
  profileTranslations,
  projects,
  projectSkills,
  projectTranslations,
  skills,
  socialLinks,
} from "@/db/schema";
import type { Database } from "@/db/types";
import type {
  CertificationInput,
  EducationInput,
  ExperienceInput,
  ProfileInput,
  ProjectInput,
} from "@/features/content/schemas";
import { LOCALES, type Locale } from "@/i18n/locales";

import type { SeedContent } from "./schema";

// The seed adds and updates, keyed by slug (or kind), and never deletes: a row
// removed from the content stays in the database. Only the skill links of a
// seeded project or experience are replaced, to follow the order given.

const PROFILE_ID = 1;

type SkillIds = ReadonlyMap<string, string>;

function translationEntries<T>(
  translations: Partial<Record<Locale, T | undefined>>,
): readonly (readonly [Locale, T])[] {
  return LOCALES.flatMap((locale) => {
    const translation = translations[locale];
    return translation === undefined ? [] : [[locale, translation] as const];
  });
}

/** Rows written with `.returning()` on an upsert always come back. */
function returnedId(rows: readonly { readonly id: string }[]): string {
  const [row] = rows;
  if (row === undefined) {
    throw new Error("An upsert returned no row.");
  }
  return row.id;
}

function skillLinks(slugs: readonly string[], skillIds: SkillIds) {
  return slugs.map((slug, sortOrder) => {
    const skillId = skillIds.get(slug);
    if (skillId === undefined) {
      throw new Error(`Unknown skill "${slug}".`);
    }
    return { skillId, sortOrder };
  });
}

async function writeProfile(db: Database, input: ProfileInput) {
  const { translations, ...values } = input;
  await db
    .insert(profile)
    .values({ id: PROFILE_ID, ...values })
    .onConflictDoUpdate({ target: profile.id, set: values });
  for (const [locale, translation] of translationEntries(translations)) {
    await db
      .insert(profileTranslations)
      .values({ profileId: PROFILE_ID, locale, ...translation })
      .onConflictDoUpdate({
        target: [profileTranslations.profileId, profileTranslations.locale],
        set: translation,
      });
  }
}

async function writeSkills(
  db: Database,
  content: SeedContent["skills"],
): Promise<SkillIds> {
  const ids = new Map<string, string>();
  for (const skill of content) {
    const rows = await db
      .insert(skills)
      .values(skill)
      .onConflictDoUpdate({ target: skills.slug, set: skill })
      .returning({ id: skills.id });
    ids.set(skill.slug, returnedId(rows));
  }
  return ids;
}

async function writeProject(
  db: Database,
  input: ProjectInput,
  skillIds: SkillIds,
) {
  const { translations, skills: skillSlugs, ...values } = input;
  const projectId = returnedId(
    await db
      .insert(projects)
      .values(values)
      .onConflictDoUpdate({ target: projects.slug, set: values })
      .returning({ id: projects.id }),
  );
  for (const [locale, translation] of translationEntries(translations)) {
    await db
      .insert(projectTranslations)
      .values({ projectId, locale, ...translation })
      .onConflictDoUpdate({
        target: [projectTranslations.projectId, projectTranslations.locale],
        set: translation,
      });
  }
  await db.delete(projectSkills).where(eq(projectSkills.projectId, projectId));
  const links = skillLinks(skillSlugs, skillIds);
  if (links.length > 0) {
    await db
      .insert(projectSkills)
      .values(links.map((link) => ({ projectId, ...link })));
  }
}

async function writeExperience(
  db: Database,
  input: ExperienceInput,
  skillIds: SkillIds,
) {
  const { translations, skills: skillSlugs, ...values } = input;
  const experienceId = returnedId(
    await db
      .insert(experiences)
      .values(values)
      .onConflictDoUpdate({ target: experiences.slug, set: values })
      .returning({ id: experiences.id }),
  );
  for (const [locale, translation] of translationEntries(translations)) {
    await db
      .insert(experienceTranslations)
      .values({ experienceId, locale, ...translation })
      .onConflictDoUpdate({
        target: [
          experienceTranslations.experienceId,
          experienceTranslations.locale,
        ],
        set: translation,
      });
  }
  await db
    .delete(experienceSkills)
    .where(eq(experienceSkills.experienceId, experienceId));
  const links = skillLinks(skillSlugs, skillIds);
  if (links.length > 0) {
    await db
      .insert(experienceSkills)
      .values(links.map((link) => ({ experienceId, ...link })));
  }
}

async function writeEducation(db: Database, input: EducationInput) {
  const { translations, ...values } = input;
  const educationId = returnedId(
    await db
      .insert(education)
      .values(values)
      .onConflictDoUpdate({ target: education.slug, set: values })
      .returning({ id: education.id }),
  );
  for (const [locale, translation] of translationEntries(translations)) {
    await db
      .insert(educationTranslations)
      .values({ educationId, locale, ...translation })
      .onConflictDoUpdate({
        target: [
          educationTranslations.educationId,
          educationTranslations.locale,
        ],
        set: translation,
      });
  }
}

async function writeCertification(db: Database, input: CertificationInput) {
  const { translations, ...values } = input;
  const certificationId = returnedId(
    await db
      .insert(certifications)
      .values(values)
      .onConflictDoUpdate({ target: certifications.slug, set: values })
      .returning({ id: certifications.id }),
  );
  for (const [locale, translation] of translationEntries(translations)) {
    await db
      .insert(certificationTranslations)
      .values({ certificationId, locale, ...translation })
      .onConflictDoUpdate({
        target: [
          certificationTranslations.certificationId,
          certificationTranslations.locale,
        ],
        set: translation,
      });
  }
}

async function writeLayout(db: Database, content: SeedContent) {
  for (const link of content.socialLinks) {
    await db
      .insert(socialLinks)
      .values(link)
      .onConflictDoUpdate({ target: socialLinks.kind, set: link });
  }
  for (const tile of content.tiles) {
    await db
      .insert(bentoTiles)
      .values(tile)
      .onConflictDoUpdate({ target: bentoTiles.kind, set: tile });
  }
}

/** Writes validated content in one transaction: a failure leaves the database untouched. */
export async function seedDatabase(
  db: Database,
  content: SeedContent,
): Promise<void> {
  await db.transaction(async (tx) => {
    await writeProfile(tx, content.profile);
    const skillIds = await writeSkills(tx, content.skills);
    for (const project of content.projects) {
      await writeProject(tx, project, skillIds);
    }
    for (const experience of content.experiences) {
      await writeExperience(tx, experience, skillIds);
    }
    for (const entry of content.education) {
      await writeEducation(tx, entry);
    }
    for (const certification of content.certifications) {
      await writeCertification(tx, certification);
    }
    await writeLayout(tx, content);
  });
}
