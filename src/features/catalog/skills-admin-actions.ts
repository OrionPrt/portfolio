"use server";

import { z } from "zod";

import { experienceSkills, projectSkills, skills } from "@/db/schema";
import type {
  ContentFormState,
  ListActionState,
} from "@/features/admin/content-form-state";
import { textFields } from "@/features/admin/form-input";
import { deleteContent, moveContent } from "@/features/admin/list-actions";
import { saveContent } from "@/features/admin/save-content";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { skillInputSchema } from "@/features/content/schemas";
import { ok } from "@/lib/result";

import { createSkillsAdminRepository } from "./skills-admin-repository";

const SKILL_ID = z.uuid();

function skillInput(fields: Readonly<Record<string, string>>) {
  return {
    slug: fields.slug ?? "",
    name: fields.name ?? "",
    domain: fields.domain ?? "",
    featured: fields.featured === "on",
  };
}

export async function createSkillAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const fields = textFields(formData);
  return saveContent({
    entity: "skill",
    schema: skillInputSchema,
    input: skillInput(fields),
    save: (db, skill) => createSkillsAdminRepository(db).create(skill),
    afterCreate: () => ADMIN_PATHS.skills,
  });
}

export async function updateSkillAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const fields = textFields(formData);
  const id = SKILL_ID.safeParse(fields.id);
  return saveContent({
    entity: "skill",
    schema: skillInputSchema,
    input: skillInput(fields),
    save: (db, skill) =>
      id.success
        ? createSkillsAdminRepository(db).update(id.data, skill)
        : Promise.resolve(ok({ status: "not_found" } as const)),
  });
}

/** Within the skill's domain: the public skills page shows them by domain. */
export async function moveSkillAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  return moveContent({
    entity: "skill",
    formData,
    siblings: (db, id) => createSkillsAdminRepository(db).siblings(id),
    reorder: (db, ids) => createSkillsAdminRepository(db).reorder(ids),
  });
}

/** Its links to projects and experiences go with it, kept in the snapshot. */
export async function deleteSkillAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  return deleteContent({
    entity: "skill",
    formData,
    target: (id) => ({
      table: skills,
      idColumn: skills.id,
      id,
      entity: "skill",
      related: [
        {
          key: "projects",
          table: projectSkills,
          foreignKey: projectSkills.skillId,
        },
        {
          key: "experiences",
          table: experienceSkills,
          foreignKey: experienceSkills.skillId,
        },
      ],
    }),
  });
}
