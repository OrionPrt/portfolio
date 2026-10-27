import { TEXT_LIMITS } from "@/features/content/limits";
import { SOCIAL_KINDS } from "@/features/content/vocabulary";
import {
  createSocialLinkAction,
  deleteSocialLinkAction,
  moveSocialLinkAction,
  updateSocialLinkAction,
} from "@/features/profile/social-links-admin-actions";
import type { SocialLinkForEdit } from "@/features/profile/social-links-admin-repository";

import { ADMIN_COPY } from "../copy";
import { CheckboxField, SelectField } from "./choice-fields";
import { ContentForm } from "./content-form";
import { DeleteEntry, MoveButtons } from "./list-actions";
import { TextField } from "./text-field";

const COPY = ADMIN_COPY.links;

interface LinkCardProps {
  readonly link: SocialLinkForEdit;
  readonly isFirst: boolean;
  readonly isLast: boolean;
}

function LinkCard({ link, isFirst, isLast }: LinkCardProps) {
  const kind = COPY.kinds[link.kind];
  return (
    <li className="bg-surface border-line rounded-tile flex flex-col gap-4 border p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto flex items-center gap-2 text-lg font-semibold tracking-tight">
          {kind}{" "}
          {!link.visible && (
            <span className="text-fg-muted border-line rounded-chip border px-1.5 font-mono text-xs font-normal">
              {COPY.hiddenBadge}
            </span>
          )}
        </h2>
        <MoveButtons
          action={moveSocialLinkAction}
          id={link.id}
          label={kind}
          isFirst={isFirst}
          isLast={isLast}
        />
        <DeleteEntry
          action={deleteSocialLinkAction}
          id={link.id}
          label={kind}
          title={COPY.deleteTitle(kind)}
        />
      </div>
      <ContentForm
        action={updateSocialLinkAction}
        hidden={{ id: link.id, kind: link.kind }}
        context={kind}
      >
        <TextField
          name="url"
          type="url"
          label={COPY.url}
          initial={link.url}
          hint={COPY.urlHint}
          invalidMessage={COPY.urlInvalid}
          maxLength={TEXT_LIMITS.url}
          isRequired
        />
        <CheckboxField
          name="visible"
          label={COPY.visible}
          initial={link.visible}
        />
      </ContentForm>
    </li>
  );
}

interface AddLinkProps {
  readonly usedKinds: readonly string[];
}

function AddLink({ usedKinds }: AddLinkProps) {
  const free = SOCIAL_KINDS.filter((kind) => !usedKinds.includes(kind));
  return (
    <section aria-labelledby="links-add" className="flex flex-col gap-4">
      <h2 id="links-add" className="text-xl font-semibold tracking-tight">
        {COPY.add}
      </h2>
      {free.length === 0 ? (
        <p className="text-fg-muted">{COPY.allUsed}</p>
      ) : (
        <ContentForm action={createSocialLinkAction}>
          <div className="grid gap-6 md:grid-cols-[12rem_1fr]">
            <SelectField
              name="kind"
              label={COPY.kind}
              initial={free[0] ?? ""}
              options={free.map((kind) => [kind, COPY.kinds[kind]] as const)}
              takenMessage={COPY.kindTaken}
            />
            <TextField
              name="url"
              type="url"
              label={COPY.url}
              initial=""
              hint={COPY.urlHint}
              invalidMessage={COPY.urlInvalid}
              maxLength={TEXT_LIMITS.url}
              isRequired
            />
          </div>
          <CheckboxField name="visible" label={COPY.visible} initial />
        </ContentForm>
      )}
    </section>
  );
}

interface SocialLinksEditorProps {
  readonly links: readonly SocialLinkForEdit[];
}

/** Each link on its own card, with its own form; then the kinds left to add. */
export function SocialLinksEditor({ links }: SocialLinksEditorProps) {
  return (
    <div className="flex flex-col gap-10">
      {links.length === 0 ? (
        <p className="text-fg-muted">{COPY.empty}</p>
      ) : (
        // role="list": Safari drops list semantics once list-style is none.
        <ol role="list" className="flex flex-col gap-4">
          {links.map((link, index) => (
            <LinkCard
              key={link.id}
              link={link}
              isFirst={index === 0}
              isLast={index === links.length - 1}
            />
          ))}
        </ol>
      )}
      <AddLink usedKinds={links.map((link) => link.kind)} />
    </div>
  );
}
