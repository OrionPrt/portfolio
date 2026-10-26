import { useTranslations } from "next-intl";

import {
  HONEYPOT_FIELD,
  type ContactValues,
} from "@/features/contact/form-state";
import {
  CONTACT_LIMITS,
  type ContactField,
  type ContactFieldErrors,
} from "@/features/contact/fields";

import { FormField } from "@/components/ui/form-field";

interface ContactFieldsProps {
  /** Scopes the fields' ids: other visited pages stay mounted, hidden. */
  readonly idPrefix: string;
  readonly errors: ContactFieldErrors;
  /** What was typed before a refusal, to refill the emptied form. */
  readonly values: ContactValues | undefined;
}

/** The message's fields, and a honeypot that only bots fill. */
export function ContactFields({
  idPrefix,
  errors,
  values,
}: ContactFieldsProps) {
  const t = useTranslations("Contact");
  const idOf = (field: string) => `${idPrefix}-${field}`;
  const errorOf = (field: ContactField): string | undefined => {
    switch (errors[field]) {
      case undefined:
        return undefined;
      case "required":
        return t("errors.required");
      case "too_short":
        return t("errors.too_short", { min: CONTACT_LIMITS.messageMin });
      case "too_long":
        return t("errors.too_long", { max: CONTACT_LIMITS[field] });
      case "invalid":
        return field === "email"
          ? t("errors.invalid_email")
          : t("errors.invalid");
    }
  };

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id={idOf("name")} label={t("name")} error={errorOf("name")}>
          {(control) => (
            <input
              {...control}
              name="name"
              autoComplete="name"
              required
              maxLength={CONTACT_LIMITS.name}
              defaultValue={values?.name}
            />
          )}
        </FormField>
        <FormField
          id={idOf("email")}
          label={t("email")}
          error={errorOf("email")}
        >
          {(control) => (
            <input
              {...control}
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={CONTACT_LIMITS.email}
              defaultValue={values?.email}
            />
          )}
        </FormField>
      </div>
      <FormField
        id={idOf("subject")}
        label={t("subject")}
        error={errorOf("subject")}
      >
        {(control) => (
          <input
            {...control}
            name="subject"
            required
            maxLength={CONTACT_LIMITS.subject}
            defaultValue={values?.subject}
          />
        )}
      </FormField>
      <FormField
        id={idOf("message")}
        label={t("message")}
        hint={t("messageHint", {
          min: CONTACT_LIMITS.messageMin,
          max: CONTACT_LIMITS.message,
        })}
        error={errorOf("message")}
      >
        {(control) => (
          <textarea
            {...control}
            name="message"
            rows={8}
            required
            minLength={CONTACT_LIMITS.messageMin}
            maxLength={CONTACT_LIMITS.message}
            defaultValue={values?.message}
          />
        )}
      </FormField>
      {/* Off screen rather than display:none, which bots learn to skip; inert,
          so no focus, pointer or assistive technology reaches it. */}
      <div inert className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor={idOf(HONEYPOT_FIELD)}>{t("honeypot")}</label>
        <input
          id={idOf(HONEYPOT_FIELD)}
          name={HONEYPOT_FIELD}
          autoComplete="off"
          defaultValue=""
        />
      </div>
    </>
  );
}
