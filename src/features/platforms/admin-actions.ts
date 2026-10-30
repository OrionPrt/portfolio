"use server";

import { z } from "zod";

import { platforms } from "@/db/schema";
import type {
  ContentFormState,
  ListActionState,
} from "@/features/admin/content-form-state";
import { blankToNull, textFields } from "@/features/admin/form-input";
import { deleteContent, moveContent } from "@/features/admin/list-actions";
import { saveContent } from "@/features/admin/save-content";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { platformInputSchema } from "@/features/content/schemas";
import { siteToday } from "@/lib/dates";
import { ok } from "@/lib/result";

import { createPlatformsAdminRepository } from "./admin-repository";

const PLATFORM_ID = z.uuid();

/** Spaces a number is written with: "12 500", "12 500". */
const NUMBER_SPACES = /[\s  ]/g;

const WHOLE_NUMBER = /^\d{1,10}$/;

/** Points as typed, read as a number; anything else is left for the schema to refuse. */
function pointsOf(typed: string | null): number | string | null {
  const digits = typed?.replace(NUMBER_SPACES, "") ?? null;
  return digits !== null && WHOLE_NUMBER.test(digits) ? Number(digits) : typed;
}

function platformInput(formData: FormData) {
  const fields = textFields(formData);
  return {
    name: fields.name ?? "",
    profileUrl: blankToNull(fields.profileUrl),
    rank: blankToNull(fields.rank),
    points: pointsOf(blankToNull(fields.points)),
    // Blank: read today, in Paris.
    updatedOn: blankToNull(fields.updatedOn) ?? siteToday(),
  };
}

export async function createPlatformAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return saveContent({
    entity: "platform",
    schema: platformInputSchema,
    input: platformInput(formData),
    save: (db, platform) => createPlatformsAdminRepository(db).create(platform),
    afterCreate: () => ADMIN_PATHS.platforms,
  });
}

export async function updatePlatformAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const id = PLATFORM_ID.safeParse(formData.get("id"));
  return saveContent({
    entity: "platform",
    schema: platformInputSchema,
    input: platformInput(formData),
    save: (db, platform) =>
      id.success
        ? createPlatformsAdminRepository(db).update(id.data, platform)
        : Promise.resolve(ok({ status: "not_found" } as const)),
  });
}

export async function movePlatformAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  return moveContent({
    entity: "platform",
    formData,
    siblings: (db) => createPlatformsAdminRepository(db).ids(),
    reorder: (db, ids) => createPlatformsAdminRepository(db).reorder(ids),
  });
}

export async function deletePlatformAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  return deleteContent({
    entity: "platform",
    formData,
    target: (id) => ({
      table: platforms,
      idColumn: platforms.id,
      id,
      entity: "platform",
    }),
  });
}
