"use server";

import { z } from "zod";

import { education, educationTranslations } from "@/db/schema";
import type {
  ContentFormState,
  ListActionState,
} from "@/features/admin/content-form-state";
import {
  blankToNull,
  textFields,
  translationsFrom,
} from "@/features/admin/form-input";
import { deleteContent } from "@/features/admin/list-actions";
import { saveContent } from "@/features/admin/save-content";
import { educationPath } from "@/features/auth/admin-paths";
import { educationContentSchema } from "@/features/content/schemas";
import { ok } from "@/lib/result";

import { createEducationAdminRepository } from "./education-admin-repository";

const EDUCATION_ID = z.uuid();

const TRANSLATED = ["degree", "description"] as const;

function educationInput(formData: FormData) {
  const fields = textFields(formData);
  return {
    school: fields.school ?? "",
    location: blankToNull(fields.location),
    logoMediaId: blankToNull(fields.logoMediaId),
    // Blank reads as missing: the field says "required", not "invalid".
    startedOn: blankToNull(fields.startedOn),
    // Blank while still under way.
    endedOn: blankToNull(fields.endedOn),
    translations: translationsFrom(fields, TRANSLATED),
  };
}

/** A new entry opens for editing, as the others do. */
export async function createEducationAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return saveContent({
    entity: "education",
    schema: educationContentSchema,
    input: educationInput(formData),
    save: (db, entry) => createEducationAdminRepository(db).create(entry),
    afterCreate: educationPath,
  });
}

export async function updateEducationAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const id = EDUCATION_ID.safeParse(formData.get("id"));
  return saveContent({
    entity: "education",
    schema: educationContentSchema,
    input: educationInput(formData),
    save: (db, entry) =>
      id.success
        ? createEducationAdminRepository(db).update(id.data, entry)
        : Promise.resolve(ok({ status: "not_found" } as const)),
  });
}

/** Its languages go with it, kept in the snapshot. */
export async function deleteEducationAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  return deleteContent({
    entity: "education",
    formData,
    target: (id) => ({
      table: education,
      idColumn: education.id,
      id,
      entity: "education",
      related: [
        {
          key: "translations",
          table: educationTranslations,
          foreignKey: educationTranslations.educationId,
        },
      ],
    }),
  });
}
