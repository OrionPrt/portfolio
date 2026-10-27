"use server";

import type { ContentFormState } from "@/features/admin/content-form-state";
import {
  blankToNull,
  textFields,
  translationsFrom,
} from "@/features/admin/form-input";
import { saveContent } from "@/features/admin/save-content";
import { profileInputSchema } from "@/features/content/schemas";
import { ok } from "@/lib/result";

import { createProfileAdminRepository } from "./admin-repository";

const TRANSLATED = [
  "headline",
  "availability",
  "pitch",
  "aboutMd",
  "lookingFor",
] as const;

export async function saveProfileAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const fields = textFields(formData);
  return saveContent({
    entity: "profile",
    schema: profileInputSchema,
    input: {
      displayName: fields.displayName ?? "",
      location: blankToNull(fields.location),
      translations: translationsFrom(fields, TRANSLATED, {
        optional: ["lookingFor"],
      }),
    },
    save: async (db, profile) => {
      const saved = await createProfileAdminRepository(db).save(profile);
      if (!saved.ok) {
        return saved;
      }
      // A language left blank is gone: the audit log keeps what it said.
      return ok({
        status: "saved",
        id: "1",
        isNew: false,
        ...(saved.data.length === 0
          ? {}
          : { diff: { removedTranslations: saved.data } }),
      } as const);
    },
  });
}
