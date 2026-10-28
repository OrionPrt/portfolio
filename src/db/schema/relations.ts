import { relations } from "drizzle-orm";

import {
  certifications,
  certificationTranslations,
  education,
  educationTranslations,
} from "./credentials";
import {
  experiences,
  experienceSkills,
  experienceTranslations,
} from "./experiences";
import { media, mediaTranslations } from "./media";
import { profile, profileTranslations } from "./profile";
import { projects, projectSkills, projectTranslations } from "./projects";
import { skills } from "./skills";

// Relations power Drizzle's query API (`db.query.projects.findMany({ with })`);
// they add no constraint, the foreign keys live on the tables.

export const profileRelations = relations(profile, ({ many }) => ({
  translations: many(profileTranslations),
}));

export const profileTranslationsRelations = relations(
  profileTranslations,
  ({ one }) => ({
    profile: one(profile, {
      fields: [profileTranslations.profileId],
      references: [profile.id],
    }),
  }),
);

export const skillsRelations = relations(skills, ({ many }) => ({
  projects: many(projectSkills),
  experiences: many(experienceSkills),
}));

export const projectsRelations = relations(projects, ({ many, one }) => ({
  translations: many(projectTranslations),
  skills: many(projectSkills),
  cover: one(media, {
    fields: [projects.coverMediaId],
    references: [media.id],
  }),
}));

export const projectTranslationsRelations = relations(
  projectTranslations,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectTranslations.projectId],
      references: [projects.id],
    }),
  }),
);

export const projectSkillsRelations = relations(projectSkills, ({ one }) => ({
  project: one(projects, {
    fields: [projectSkills.projectId],
    references: [projects.id],
  }),
  skill: one(skills, {
    fields: [projectSkills.skillId],
    references: [skills.id],
  }),
}));

export const experiencesRelations = relations(experiences, ({ many, one }) => ({
  translations: many(experienceTranslations),
  skills: many(experienceSkills),
  logo: one(media, {
    fields: [experiences.logoMediaId],
    references: [media.id],
  }),
}));

export const experienceTranslationsRelations = relations(
  experienceTranslations,
  ({ one }) => ({
    experience: one(experiences, {
      fields: [experienceTranslations.experienceId],
      references: [experiences.id],
    }),
  }),
);

export const experienceSkillsRelations = relations(
  experienceSkills,
  ({ one }) => ({
    experience: one(experiences, {
      fields: [experienceSkills.experienceId],
      references: [experiences.id],
    }),
    skill: one(skills, {
      fields: [experienceSkills.skillId],
      references: [skills.id],
    }),
  }),
);

export const educationRelations = relations(education, ({ many, one }) => ({
  translations: many(educationTranslations),
  logo: one(media, {
    fields: [education.logoMediaId],
    references: [media.id],
  }),
}));

export const educationTranslationsRelations = relations(
  educationTranslations,
  ({ one }) => ({
    education: one(education, {
      fields: [educationTranslations.educationId],
      references: [education.id],
    }),
  }),
);

export const certificationsRelations = relations(
  certifications,
  ({ many, one }) => ({
    translations: many(certificationTranslations),
    badge: one(media, {
      fields: [certifications.badgeMediaId],
      references: [media.id],
    }),
  }),
);

export const certificationTranslationsRelations = relations(
  certificationTranslations,
  ({ one }) => ({
    certification: one(certifications, {
      fields: [certificationTranslations.certificationId],
      references: [certifications.id],
    }),
  }),
);

export const mediaRelations = relations(media, ({ many }) => ({
  translations: many(mediaTranslations),
}));

export const mediaTranslationsRelations = relations(
  mediaTranslations,
  ({ one }) => ({
    media: one(media, {
      fields: [mediaTranslations.mediaId],
      references: [media.id],
    }),
  }),
);
