"use server";

import { z } from "zod";

import { socialLinks } from "@/db/schema";
import type {
  ContentFormState,
  ListActionState,
} from "@/features/admin/content-form-state";
import { textFields } from "@/features/admin/form-input";
import { deleteContent, moveContent } from "@/features/admin/list-actions";
import { saveContent } from "@/features/admin/save-content";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { socialLinkInputSchema } from "@/features/content/schemas";
import { ok } from "@/lib/result";

import { createSocialLinksAdminRepository } from "./social-links-admin-repository";

const LINK_ID = z.uuid();

function linkInput(fields: Readonly<Record<string, string>>) {
  return {
    kind: fields.kind ?? "",
    url: fields.url ?? "",
    visible: fields.visible === "on",
  };
}

export async function createSocialLinkAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const fields = textFields(formData);
  return saveContent({
    entity: "social_link",
    schema: socialLinkInputSchema,
    input: linkInput(fields),
    save: (db, link) => createSocialLinksAdminRepository(db).create(link),
    afterCreate: () => ADMIN_PATHS.links,
  });
}

export async function updateSocialLinkAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const fields = textFields(formData);
  const id = LINK_ID.safeParse(fields.id);
  return saveContent({
    entity: "social_link",
    schema: socialLinkInputSchema,
    input: linkInput(fields),
    save: (db, link) =>
      id.success
        ? createSocialLinksAdminRepository(db).update(id.data, link)
        : Promise.resolve(ok({ status: "not_found" } as const)),
  });
}

export async function moveSocialLinkAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  return moveContent({
    entity: "social_link",
    formData,
    siblings: (db) => createSocialLinksAdminRepository(db).ids(),
    reorder: (db, ids) => createSocialLinksAdminRepository(db).reorder(ids),
  });
}

export async function deleteSocialLinkAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  return deleteContent({
    entity: "social_link",
    formData,
    target: (id) => ({
      table: socialLinks,
      idColumn: socialLinks.id,
      id,
      entity: "social_link",
    }),
  });
}
