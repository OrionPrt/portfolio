import { TEXT_LIMITS } from "@/features/content/limits";
import {
  createPlatformAction,
  deletePlatformAction,
  movePlatformAction,
  updatePlatformAction,
} from "@/features/platforms/admin-actions";
import type { PlatformForEdit } from "@/features/platforms/admin-repository";

import { ADMIN_COPY } from "../copy";
import { formatDay, formatNumber } from "../format";
import { ContentForm } from "./content-form";
import { DeleteEntry, MoveButtons } from "./list-actions";
import { TextField } from "./text-field";

const COPY = ADMIN_COPY.platforms;

/** The values a form starts from: a new platform's are empty. */
type PlatformValues = Pick<
  PlatformForEdit,
  "name" | "profileUrl" | "rank" | "points" | "updatedOn"
>;

const BLANK: PlatformValues = {
  name: "",
  profileUrl: null,
  rank: null,
  points: null,
  updatedOn: "",
};

/** The fields of one platform, for adding it or editing it. */
function PlatformFields({ platform }: { readonly platform: PlatformValues }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <TextField
        name="name"
        label={COPY.name}
        initial={platform.name}
        takenMessage={COPY.nameTaken}
        maxLength={TEXT_LIMITS.name}
        isRequired
      />
      <TextField
        name="profileUrl"
        type="url"
        label={COPY.profileUrl}
        initial={platform.profileUrl ?? ""}
        hint={COPY.profileUrlHint}
        invalidMessage={COPY.profileUrlInvalid}
        maxLength={TEXT_LIMITS.url}
      />
      <TextField
        name="rank"
        label={COPY.rank}
        initial={platform.rank ?? ""}
        hint={COPY.rankHint}
        maxLength={TEXT_LIMITS.name}
      />
      <TextField
        name="points"
        label={COPY.points}
        initial={platform.points === null ? "" : String(platform.points)}
        hint={COPY.pointsHint}
        invalidMessage={COPY.pointsInvalid}
        inputMode="numeric"
      />
      <TextField
        name="updatedOn"
        type="date"
        label={COPY.updatedOn}
        initial={platform.updatedOn}
        hint={COPY.updatedOnHint}
      />
    </div>
  );
}

/** "Pro Hacker · 12 500 points · relevé le 30 octobre 2026". */
function summaryOf(platform: PlatformForEdit): string {
  return COPY.summary([
    ...(platform.rank === null ? [] : [platform.rank]),
    ...(platform.points === null
      ? []
      : [COPY.pointsValue(formatNumber(platform.points))]),
    COPY.readOn(formatDay(platform.updatedOn)),
  ]);
}

interface PlatformCardProps {
  readonly platform: PlatformForEdit;
  readonly isFirst: boolean;
  readonly isLast: boolean;
}

function PlatformCard({ platform, isFirst, isLast }: PlatformCardProps) {
  return (
    <li className="bg-surface border-line rounded-tile flex flex-col gap-4 border p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto flex min-w-0 flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight wrap-anywhere">
            {platform.name}
          </h2>
          <p className="text-fg-muted text-sm">{summaryOf(platform)}</p>
        </div>
        <MoveButtons
          action={movePlatformAction}
          id={platform.id}
          label={platform.name}
          isFirst={isFirst}
          isLast={isLast}
        />
        <DeleteEntry
          action={deletePlatformAction}
          id={platform.id}
          label={platform.name}
          title={COPY.deleteTitle(platform.name)}
        />
      </div>
      <ContentForm
        action={updatePlatformAction}
        hidden={{ id: platform.id }}
        context={platform.name}
      >
        <PlatformFields platform={platform} />
      </ContentForm>
    </li>
  );
}

interface PlatformsEditorProps {
  readonly platforms: readonly PlatformForEdit[];
}

/** Each platform on its own card, with its own form; then one more to add. */
export function PlatformsEditor({ platforms }: PlatformsEditorProps) {
  return (
    <div className="flex flex-col gap-10">
      {platforms.length === 0 ? (
        <p className="text-fg-muted">{COPY.empty}</p>
      ) : (
        // role="list": Safari drops list semantics once list-style is none.
        <ol role="list" className="flex flex-col gap-4">
          {platforms.map((platform, index) => (
            <PlatformCard
              key={platform.id}
              platform={platform}
              isFirst={index === 0}
              isLast={index === platforms.length - 1}
            />
          ))}
        </ol>
      )}
      <section aria-labelledby="platforms-add" className="flex flex-col gap-4">
        <h2 id="platforms-add" className="text-xl font-semibold tracking-tight">
          {COPY.add}
        </h2>
        <ContentForm action={createPlatformAction}>
          <PlatformFields platform={BLANK} />
        </ContentForm>
      </section>
    </div>
  );
}
