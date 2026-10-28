"use server";

import { z } from "zod";

import { certifications, certificationTranslations } from "@/db/schema";
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
import { certificationPath } from "@/features/auth/admin-paths";
import { certificationContentSchema } from "@/features/content/schemas";
import { ok } from "@/lib/result";

import { createCertificationsAdminRepository } from "./certifications-admin-repository";

const CERTIFICATION_ID = z.uuid();

const TRANSLATED = ["description"] as const;

function certificationInput(formData: FormData) {
  const fields = textFields(formData);
  return {
    name: fields.name ?? "",
    issuer: fields.issuer ?? "",
    // Blank reads as missing: the field says "required", not "invalid".
    issuedOn: blankToNull(fields.issuedOn),
    // Blank when it never expires.
    expiresOn: blankToNull(fields.expiresOn),
    credentialId: blankToNull(fields.credentialId),
    verifyUrl: blankToNull(fields.verifyUrl),
    translations: translationsFrom(fields, TRANSLATED),
  };
}

/** A new certification opens for editing, as the other entries do. */
export async function createCertificationAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return saveContent({
    entity: "certification",
    schema: certificationContentSchema,
    input: certificationInput(formData),
    save: (db, certification) =>
      createCertificationsAdminRepository(db).create(certification),
    afterCreate: certificationPath,
  });
}

export async function updateCertificationAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const id = CERTIFICATION_ID.safeParse(formData.get("id"));
  return saveContent({
    entity: "certification",
    schema: certificationContentSchema,
    input: certificationInput(formData),
    save: (db, certification) =>
      id.success
        ? createCertificationsAdminRepository(db).update(id.data, certification)
        : Promise.resolve(ok({ status: "not_found" } as const)),
  });
}

/** Its languages go with it, kept in the snapshot. */
export async function deleteCertificationAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  return deleteContent({
    entity: "certification",
    formData,
    target: (id) => ({
      table: certifications,
      idColumn: certifications.id,
      id,
      entity: "certification",
      related: [
        {
          key: "translations",
          table: certificationTranslations,
          foreignKey: certificationTranslations.certificationId,
        },
      ],
    }),
  });
}
