import { TEXT_LIMITS } from "@/features/content/limits";
import { saveProfileAction } from "@/features/profile/admin-actions";
import type { ProfileForEdit } from "@/features/profile/admin-repository";
import type { Locale } from "@/i18n/locales";

import { ADMIN_COPY } from "../copy";
import { BilingualField } from "./bilingual-field";
import { ContentForm } from "./content-form";
import { TextField } from "./text-field";

const COPY = ADMIN_COPY.profile;

type Translated = keyof NonNullable<ProfileForEdit["translations"]["fr"]>;

interface ProfileFormProps {
  /** Undefined before the first save. */
  readonly profile: ProfileForEdit | undefined;
}

function IdentityFields({ profile }: ProfileFormProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <TextField
        name="displayName"
        label={COPY.displayName}
        initial={profile?.displayName ?? ""}
        maxLength={TEXT_LIMITS.name}
        isRequired
      />
      <TextField
        name="location"
        label={COPY.location}
        hint={COPY.optional}
        initial={profile?.location ?? ""}
        maxLength={TEXT_LIMITS.name}
      />
    </div>
  );
}

/** Each translated field: its label, size and kind, in the form's order. */
const TRANSLATED: readonly {
  readonly name: Translated;
  readonly label: string;
  readonly maxLength: number;
  readonly kind?: "multiline" | "markdown";
  readonly hint?: string;
  readonly isRequired?: boolean;
}[] = [
  {
    name: "headline",
    label: COPY.headline,
    hint: COPY.headlineHint,
    maxLength: TEXT_LIMITS.tagline,
    isRequired: true,
  },
  {
    name: "availability",
    label: COPY.availability,
    maxLength: TEXT_LIMITS.tagline,
    isRequired: true,
  },
  {
    name: "pitch",
    label: COPY.pitch,
    kind: "multiline",
    maxLength: TEXT_LIMITS.summary,
    isRequired: true,
  },
  {
    name: "lookingFor",
    label: COPY.lookingFor,
    hint: COPY.optional,
    kind: "multiline",
    maxLength: TEXT_LIMITS.summary,
  },
  {
    name: "aboutMd",
    label: COPY.aboutMd,
    hint: ADMIN_COPY.content.markdown.hint,
    kind: "markdown",
    maxLength: TEXT_LIMITS.markdown,
  },
];

/** The profile in both languages; one save for the whole of it. */
export function ProfileForm({ profile }: ProfileFormProps) {
  const initial = (
    field: Translated,
  ): Partial<Record<Locale, string | null>> => ({
    fr: profile?.translations.fr?.[field] ?? "",
    en: profile?.translations.en?.[field] ?? "",
  });
  return (
    <ContentForm action={saveProfileAction}>
      <IdentityFields profile={profile} />
      {TRANSLATED.map((field) => (
        <BilingualField
          key={field.name}
          {...field}
          initial={initial(field.name)}
        />
      ))}
    </ContentForm>
  );
}
