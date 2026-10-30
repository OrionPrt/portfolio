"use server";

import { z } from "zod";

import { posts, postSkills, postTranslations } from "@/db/schema";
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
import { postPath } from "@/features/auth/admin-paths";
import { postInputSchema } from "@/features/content/schemas";
import { siteToday } from "@/lib/dates";
import { ok } from "@/lib/result";

import { createPostsAdminRepository } from "./admin-repository";

const POST_ID = z.uuid();

const TRANSLATED = ["title", "excerpt", "bodyMd"] as const;

/** A post published without a day is published today, in Paris. */
function publishedOnOf(fields: Readonly<Record<string, string>>) {
  const given = blankToNull(fields.publishedOn);
  return given === null && fields.status === "published" ? siteToday() : given;
}

function postInput(formData: FormData) {
  const fields = textFields(formData);
  return {
    slug: fields.slug ?? "",
    kind: fields.kind ?? "",
    status: fields.status ?? "",
    publishedOn: publishedOnOf(fields),
    platform: blankToNull(fields.platform),
    difficulty: blankToNull(fields.difficulty),
    retiredOn: blankToNull(fields.retiredOn),
    isDisclosureAllowed: fields.isDisclosureAllowed === "on",
    coverMediaId: blankToNull(fields.coverMediaId),
    skills: textList(formData, "skills"),
    // One language or both: none is required (ADR-0008).
    translations: translationsFrom(fields, TRANSLATED, {
      isAnyLocaleOptional: true,
    }),
  };
}

/** A new post opens for editing. */
export async function createPostAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return saveContent({
    entity: "post",
    schema: postInputSchema,
    input: postInput(formData),
    save: (db, post) => createPostsAdminRepository(db).create(post),
    afterCreate: postPath,
  });
}

export async function updatePostAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const id = POST_ID.safeParse(formData.get("id"));
  return saveContent({
    entity: "post",
    schema: postInputSchema,
    input: postInput(formData),
    save: (db, post) =>
      id.success
        ? createPostsAdminRepository(db).update(id.data, post)
        : Promise.resolve(ok({ status: "not_found" } as const)),
  });
}

/** Its languages and skill links go with it, kept in the snapshot; so do the redirects to it. */
export async function deletePostAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  return deleteContent({
    entity: "post",
    formData,
    target: (id) => ({
      table: posts,
      idColumn: posts.id,
      id,
      entity: "post",
      collection: "posts",
      related: [
        {
          key: "translations",
          table: postTranslations,
          foreignKey: postTranslations.postId,
        },
        { key: "skills", table: postSkills, foreignKey: postSkills.postId },
      ],
    }),
  });
}
