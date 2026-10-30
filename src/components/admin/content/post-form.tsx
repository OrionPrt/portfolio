import type { ContentAction } from "@/features/admin/content-form-state";
import type { SkillOption } from "@/features/catalog/skill-options";
import { TEXT_LIMITS } from "@/features/content/limits";
import {
  DIFFICULTIES,
  PLATFORMS,
  POST_KINDS,
} from "@/features/content/vocabulary";
import type { MediaOption } from "@/features/media/types";
import type { PostForEdit } from "@/features/posts/admin-repository";

import { ADMIN_COPY } from "../copy";
import { CheckboxField, SelectField } from "./choice-fields";
import { ContentForm } from "./content-form";
import {
  BilingualFields,
  FormSection,
  PublicationFields,
  type TranslatedField,
} from "./entry-fields";
import { MediaField } from "./media-field";
import { MediaOptionsProvider } from "./media-options";
import { PostLanguageProblem } from "./post-language-problem";
import { SkillPicker } from "./skill-picker";
import { TextField } from "./text-field";

const COPY = ADMIN_COPY.posts;

const KIND_OPTIONS = POST_KINDS.map(
  (kind) => [kind, COPY.kinds[kind]] as const,
);
const PLATFORM_OPTIONS = [
  ["", COPY.none] as const,
  ...PLATFORMS.map((platform) => [platform, COPY.platforms[platform]] as const),
];
const DIFFICULTY_OPTIONS = [
  ["", COPY.none] as const,
  ...DIFFICULTIES.map(
    (difficulty) => [difficulty, COPY.difficulties[difficulty]] as const,
  ),
];

type Translated = keyof NonNullable<PostForEdit["translations"]["fr"]>;

/** Each language filled in has all three: none is required on its own. */
const CONTENT: readonly TranslatedField<Translated>[] = [
  { name: "title", label: COPY.name, maxLength: TEXT_LIMITS.title },
  {
    name: "excerpt",
    label: COPY.excerpt,
    hint: COPY.excerptHint,
    kind: "multiline",
    maxLength: TEXT_LIMITS.excerpt,
  },
  {
    name: "bodyMd",
    label: COPY.body,
    hint: COPY.bodyHint,
    kind: "markdown",
    maxLength: TEXT_LIMITS.markdown,
  },
];

function ChallengeFields({ post }: { readonly post: PostForEdit | undefined }) {
  return (
    // Hidden while the kind is "article" (globals.css): the server drops it then.
    <div data-writeup-only="">
      <FormSection title={COPY.challenge}>
        <p className="text-fg-muted text-sm">{COPY.challengeHint}</p>
        <div className="grid gap-6 md:grid-cols-2">
          <SelectField
            name="platform"
            label={COPY.platform}
            initial={post?.platform ?? ""}
            options={PLATFORM_OPTIONS}
            invalidMessage={COPY.platformInvalid}
            isRequired={false}
          />
          <SelectField
            name="difficulty"
            label={COPY.difficulty}
            initial={post?.difficulty ?? ""}
            options={DIFFICULTY_OPTIONS}
            isRequired={false}
          />
          <TextField
            name="retiredOn"
            type="date"
            label={COPY.retiredOn}
            hint={COPY.retiredOnHint}
            invalidMessage={COPY.retiredOnInvalid}
            initial={post?.retiredOn ?? ""}
          />
          <CheckboxField
            name="isDisclosureAllowed"
            label={COPY.disclosureAllowed}
            hint={COPY.disclosureAllowedHint}
            initial={post?.isDisclosureAllowed ?? false}
          />
        </div>
      </FormSection>
    </div>
  );
}

interface PostFormProps {
  readonly action: ContentAction;
  /** The post to edit; undefined for a new one. */
  readonly post?: PostForEdit;
  /** The catalog its skills are picked from. */
  readonly skills: readonly SkillOption[];
  /** The library its cover and images are picked from. */
  readonly media: readonly MediaOption[];
}

/** An article or a write-up, in one language or both; one save for all of it. */
export function PostForm({ action, post, skills, media }: PostFormProps) {
  return (
    <MediaOptionsProvider options={media}>
      <ContentForm
        action={action}
        hidden={post === undefined ? {} : { id: post.id }}
      >
        <PublicationFields
          status={post?.status ?? "draft"}
          slug={post?.slug ?? ""}
          slugTaken={COPY.slugTaken}
        >
          <div className="grid gap-6 md:grid-cols-2">
            <SelectField
              name="kind"
              label={COPY.kind}
              initial={post?.kind ?? "article"}
              options={KIND_OPTIONS}
            />
            <TextField
              name="publishedOn"
              type="date"
              label={COPY.publishedOn}
              hint={COPY.publishedOnHint}
              initial={post?.publishedOn ?? ""}
            />
          </div>
        </PublicationFields>
        <ChallengeFields post={post} />
        <FormSection title={COPY.content}>
          <p className="text-fg-muted text-sm">{COPY.languageHint}</p>
          <PostLanguageProblem />
          <MediaField
            name="coverMediaId"
            label={COPY.cover}
            initial={post?.coverMediaId ?? null}
            options={media}
          />
          <BilingualFields
            fields={CONTENT}
            translations={post?.translations}
            isTranslation={false}
          />
        </FormSection>
        <SkillPicker
          name="skills"
          skills={skills}
          initial={post?.skills ?? []}
        />
      </ContentForm>
    </MediaOptionsProvider>
  );
}
