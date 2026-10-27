"use server";

import { z } from "zod";

import {
  experiences,
  experienceSkills,
  experienceTranslations,
} from "@/db/schema";
import type {
  ContentFormState,
  ListActionState,
} from "@/features/admin/content-form-state";
import {
  blankToNull,
  textFields,
  textList,
  translationsFrom,
} from "@/features/admin/form-input";
import { deleteContent } from "@/features/admin/list-actions";
import { saveContent } from "@/features/admin/save-content";
import { experiencePath } from "@/features/auth/admin-paths";
import { experienceInputSchema } from "@/features/content/schemas";
import { ok } from "@/lib/result";

import { createExperiencesAdminRepository } from "./admin-repository";

const EXPERIENCE_ID = z.uuid();

const TRANSLATED = [
  "role",
  "summaryContext",
  "summaryAction",
  "summaryResult",
  "technicalMd",
] as const;

function experienceInput(formData: FormData) {
  const fields = textFields(formData);
  return {
    slug: fields.slug ?? "",
    company: fields.company ?? "",
    companyUrl: blankToNull(fields.companyUrl),
    location: blankToNull(fields.location),
    employmentType: fields.employmentType ?? "",
    status: fields.status ?? "",
    // Blank reads as missing: the field says "required", not "invalid".
    startedOn: blankToNull(fields.startedOn),
    // Blank while the position is current.
    endedOn: blankToNull(fields.endedOn),
    skills: textList(formData, "skills"),
    translations: translationsFrom(fields, TRANSLATED),
  };
}

/** A new experience opens for editing: its English, its skills come next. */
export async function createExperienceAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return saveContent({
    entity: "experience",
    schema: experienceInputSchema,
    input: experienceInput(formData),
    save: (db, experience) =>
      createExperiencesAdminRepository(db).create(experience),
    afterCreate: experiencePath,
  });
}

export async function updateExperienceAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const id = EXPERIENCE_ID.safeParse(formData.get("id"));
  return saveContent({
    entity: "experience",
    schema: experienceInputSchema,
    input: experienceInput(formData),
    save: (db, experience) =>
      id.success
        ? createExperiencesAdminRepository(db).update(id.data, experience)
        : Promise.resolve(ok({ status: "not_found" } as const)),
  });
}

/** Its languages and skill links go with it, kept in the snapshot; so do the redirects to it. */
export async function deleteExperienceAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  return deleteContent({
    entity: "experience",
    formData,
    target: (id) => ({
      table: experiences,
      idColumn: experiences.id,
      id,
      entity: "experience",
      collection: "experiences",
      related: [
        {
          key: "translations",
          table: experienceTranslations,
          foreignKey: experienceTranslations.experienceId,
        },
        {
          key: "skills",
          table: experienceSkills,
          foreignKey: experienceSkills.experienceId,
        },
      ],
    }),
  });
}
