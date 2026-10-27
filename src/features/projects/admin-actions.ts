"use server";

import { z } from "zod";

import { projects, projectSkills, projectTranslations } from "@/db/schema";
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
import { deleteContent, moveContent } from "@/features/admin/list-actions";
import { saveContent } from "@/features/admin/save-content";
import { projectPath } from "@/features/auth/admin-paths";
import { projectInputSchema } from "@/features/content/schemas";
import { ok } from "@/lib/result";

import { createProjectsAdminRepository } from "./admin-repository";

const PROJECT_ID = z.uuid();

const TRANSLATED = [
  "title",
  "tagline",
  "summaryContext",
  "summaryAction",
  "summaryResult",
  "technicalMd",
  "seoDescription",
] as const;

function projectInput(formData: FormData) {
  const fields = textFields(formData);
  return {
    slug: fields.slug ?? "",
    domain: fields.domain ?? "",
    status: fields.status ?? "",
    featured: fields.featured === "on",
    repoUrl: blankToNull(fields.repoUrl),
    demoUrl: blankToNull(fields.demoUrl),
    startedOn: blankToNull(fields.startedOn),
    endedOn: blankToNull(fields.endedOn),
    skills: textList(formData, "skills"),
    translations: translationsFrom(fields, TRANSLATED, {
      optional: ["seoDescription"],
    }),
  };
}

/** A new project opens for editing: its English, its skills come next. */
export async function createProjectAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return saveContent({
    entity: "project",
    schema: projectInputSchema,
    input: projectInput(formData),
    save: (db, project) => createProjectsAdminRepository(db).create(project),
    afterCreate: projectPath,
  });
}

export async function updateProjectAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const id = PROJECT_ID.safeParse(formData.get("id"));
  return saveContent({
    entity: "project",
    schema: projectInputSchema,
    input: projectInput(formData),
    save: (db, project) =>
      id.success
        ? createProjectsAdminRepository(db).update(id.data, project)
        : Promise.resolve(ok({ status: "not_found" } as const)),
  });
}

/** Within its group: the site shows the featured projects first. */
export async function moveProjectAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  return moveContent({
    entity: "project",
    formData,
    siblings: (db, id) => createProjectsAdminRepository(db).siblings(id),
    reorder: (db, ids) => createProjectsAdminRepository(db).reorder(ids),
  });
}

/** Its languages and skill links go with it, kept in the snapshot; so do the redirects to it. */
export async function deleteProjectAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  return deleteContent({
    entity: "project",
    formData,
    target: (id) => ({
      table: projects,
      idColumn: projects.id,
      id,
      entity: "project",
      collection: "projects",
      related: [
        {
          key: "translations",
          table: projectTranslations,
          foreignKey: projectTranslations.projectId,
        },
        {
          key: "skills",
          table: projectSkills,
          foreignKey: projectSkills.projectId,
        },
      ],
    }),
  });
}
