import { TEXT_LIMITS } from "@/features/content/limits";
import { saveProfileAction } from "@/features/profile/admin-actions";
import type { MediaOption } from "@/features/media/types";
import type { ProfileForEdit } from "@/features/profile/admin-repository";
import type { Locale } from "@/i18n/locales";

import { ADMIN_COPY } from "../copy";
import { BilingualField } from "./bilingual-field";
import { ContentForm } from "./content-form";
import { MediaOptionsProvider } from "./media-options";
import { TextField } from "./text-field";

const COPY = ADMIN_COPY.profile;

type Translated = keyof NonNullable<ProfileForEdit["translations"]["fr"]>;

interface ProfileFormProps {
  /** Undefined before the first save. */
  readonly profile: ProfileForEdit | undefined;
  /** The library the about text's images are inserted from. */
  readonly media: readonly MediaOption[];
}

function IdentityFields({ profile }: Pick<ProfileFormProps, "profile">) {
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
export function ProfileForm({ profile, media }: ProfileFormProps) {
  const initial = (
    field: Translated,
  ): Partial<Record<Locale, string | null>> => ({
    fr: profile?.translations.fr?.[field] ?? "",
    en: profile?.translations.en?.[field] ?? "",
  });
  return (
    <MediaOptionsProvider options={media}>
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
    </MediaOptionsProvider>
  );
}
