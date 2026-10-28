import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import type { TranslationState } from "@/features/admin/completeness";
import type { ContentStatus } from "@/features/content/vocabulary";

import { ADMIN_COPY } from "../copy";
import { DeleteEntry, MoveButtons, type ListAction } from "./list-actions";

const COPY = ADMIN_COPY.content;

export type BadgeTone = "accent" | "signal" | "muted";

const BADGE_CLASSES: Readonly<Record<BadgeTone, string>> = {
  accent: "bg-accent/15 text-fg",
  signal: "bg-signal/15 text-fg",
  muted: "border-line text-fg-muted border",
};

export interface Badge {
  readonly label: string;
  readonly tone: BadgeTone;
}

/** How far the English goes, when not all the way. */
export function englishBadges(english: TranslationState): readonly Badge[] {
  return english === "complete"
    ? []
    : [{ label: ADMIN_COPY.entries.english[english], tone: "signal" }];
}

/** What an entry still lacks to show as it should: published, translated. */
export function entryBadges(
  status: ContentStatus,
  english: TranslationState,
): readonly Badge[] {
  return [
    ...(status === "draft"
      ? [{ label: ADMIN_COPY.entries.statuses.draft, tone: "muted" } as const]
      : []),
    ...englishBadges(english),
  ];
}

interface EntryRowProps {
  readonly id: string;
  /** The entry, in words: its name or its title. */
  readonly label: string;
  readonly badges?: readonly Badge[];
  /** The line under it: its slug, what links it, its dates. */
  readonly details: ReactNode;
  readonly editHref: string;
  /** One step up or down within its group; none in a list ordered by date. */
  readonly move?: {
    readonly action: ListAction;
    readonly isFirst: boolean;
    readonly isLast: boolean;
  };
  readonly deleteAction: ListAction;
  readonly deleteTitle: string;
  readonly deleteConsequence?: string;
}

/** An entry of an admin list: what it is, then what can be done with it. */
export function EntryRow({
  id,
  label,
  badges = [],
  details,
  editHref,
  move,
  deleteAction,
  deleteTitle,
  deleteConsequence,
}: EntryRowProps) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{label}</span>
          {badges.map((badge) => (
            // The space keeps them apart when read: the gap is only drawn.
            <Fragment key={badge.label}>
              {" "}
              <span
                className={`${BADGE_CLASSES[badge.tone]} rounded-chip px-1.5 font-mono text-xs`}
              >
                {badge.label}
              </span>
            </Fragment>
          ))}
        </p>
        <p className="text-fg-muted text-sm">{details}</p>
      </div>
      {move !== undefined && (
        <MoveButtons
          action={move.action}
          id={id}
          label={label}
          isFirst={move.isFirst}
          isLast={move.isLast}
        />
      )}
      <Link
        href={editHref}
        className="border-line hover:border-fg-muted rounded-control inline-flex min-h-10 items-center border px-3 text-sm font-medium"
      >
        {COPY.edit} <span className="sr-only">{label}</span>
      </Link>
      <DeleteEntry
        action={deleteAction}
        id={id}
        label={label}
        title={deleteTitle}
        consequence={deleteConsequence}
      />
    </li>
  );
}

interface EntryListProps<T extends { readonly id: string }> {
  readonly entries: readonly T[];
  readonly empty: string;
  readonly row: (entry: T, index: number) => ReactNode;
}

/** The entries, in the site's order; or why there are none. */
export function EntryList<T extends { readonly id: string }>({
  entries,
  empty,
  row,
}: EntryListProps<T>) {
  return entries.length === 0 ? (
    <p className="text-fg-muted">{empty}</p>
  ) : (
    // role="list": Safari drops list semantics once list-style is none.
    <ol
      role="list"
      className="border-line bg-surface rounded-tile divide-line divide-y border"
    >
      {entries.map((entry, index) => (
        <Fragment key={entry.id}>{row(entry, index)}</Fragment>
      ))}
    </ol>
  );
}

interface EntryGroupProps<
  T extends { readonly id: string },
> extends EntryListProps<T> {
  /** Unique on the page: it names the section. */
  readonly headingId: string;
  readonly title: string;
}

/** A group of a list the site shows in groups: each keeps its own order. */
export function EntryGroup<T extends { readonly id: string }>({
  headingId,
  title,
  ...list
}: EntryGroupProps<T>) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <EntryList {...list} />
    </section>
  );
}
