import type { ContentAction } from "@/features/admin/content-form-state";
import type { CertificationForEdit } from "@/features/catalog/certifications-admin-repository";
import { TEXT_LIMITS } from "@/features/content/limits";

import { ADMIN_COPY } from "../copy";
import { ContentForm } from "./content-form";
import {
  BilingualFields,
  DateFields,
  FormSection,
  UrlField,
  type TranslatedField,
} from "./entry-fields";
import { TextField } from "./text-field";

const COPY = ADMIN_COPY.certifications;

const TRANSLATED: readonly TranslatedField<"description">[] = [
  {
    name: "description",
    label: COPY.description,
    hint: COPY.descriptionHint,
    kind: "multiline",
    maxLength: TEXT_LIMITS.summary,
  },
];

interface CertificationFormProps {
  readonly action: ContentAction;
  /** The certification to edit; undefined for a new one. */
  readonly certification?: CertificationForEdit;
}

/** A certification, its proof and its description in both languages; public once saved. */
export function CertificationForm({
  action,
  certification,
}: CertificationFormProps) {
  return (
    <ContentForm
      action={action}
      hidden={certification === undefined ? {} : { id: certification.id }}
      saveNote={ADMIN_COPY.entries.publicOnSave}
    >
      <FormSection title={COPY.credential}>
        <div className="grid gap-6 md:grid-cols-2">
          <TextField
            name="name"
            label={COPY.name}
            initial={certification?.name ?? ""}
            maxLength={TEXT_LIMITS.name}
            isRequired
          />
          <TextField
            name="issuer"
            label={COPY.issuer}
            initial={certification?.issuer ?? ""}
            maxLength={TEXT_LIMITS.name}
            isRequired
          />
        </div>
        <DateFields
          start={{
            name: "issuedOn",
            label: COPY.issuedOn,
            initial: certification?.issuedOn ?? null,
            isRequired: true,
          }}
          end={{
            name: "expiresOn",
            label: COPY.expiresOn,
            initial: certification?.expiresOn ?? null,
            hint: COPY.expiresOnHint,
            invalid: COPY.expiresOnInvalid,
          }}
        />
        <div className="grid gap-6 md:grid-cols-2">
          <TextField
            name="credentialId"
            label={COPY.credentialId}
            hint={ADMIN_COPY.entries.optional}
            initial={certification?.credentialId ?? ""}
            maxLength={TEXT_LIMITS.name}
          />
          <UrlField
            name="verifyUrl"
            label={COPY.verifyUrl}
            initial={certification?.verifyUrl ?? null}
          />
        </div>
        <BilingualFields
          fields={TRANSLATED}
          translations={certification?.translations}
        />
      </FormSection>
    </ContentForm>
  );
}
