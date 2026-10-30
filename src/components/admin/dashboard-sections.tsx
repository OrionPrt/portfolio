import Link from "next/link";

import { MAX_MEDIA } from "@/db/limits";
import type {
  ContentToDo,
  EntryKind,
  EntryRef,
  MediaSummary,
  ToTranslate,
} from "@/features/admin/dashboard-repository";
import type { AuditEntry } from "@/features/auth/audit-repository";
import {
  ADMIN_PATHS,
  certificationPath,
  educationPath,
  experiencePath,
  postPath,
  projectPath,
} from "@/features/auth/admin-paths";
import type { Result } from "@/lib/result";

import { AuditList } from "./audit-list";
import { ADMIN_COPY } from "./copy";

const COPY = ADMIN_COPY.dashboard;
const KINDS = ADMIN_COPY.media.usageKinds;

// Work to do stands out (a coloured edge); what is only information recedes.
const TASK =
  "bg-surface border-line border-l-signal rounded-tile flex flex-col gap-3 border border-l-4 p-5";
const INFO =
  "bg-surface-muted/40 border-line rounded-tile flex flex-col gap-3 border p-5";
const INFO_TITLE =
  "text-fg-muted font-mono text-xs tracking-[0.12em] uppercase";
const LINK =
  "text-fg font-medium underline underline-offset-4 hover:no-underline";

/** The most a group shows at first; the others are one disclosure away. */
const MAX_SHOWN = 8;

const ENTRY_PATHS: Readonly<Record<EntryKind, (id: string) => string>> = {
  profile: () => ADMIN_PATHS.profile,
  project: projectPath,
  experience: experiencePath,
  education: educationPath,
  certification: certificationPath,
  post: postPath,
};

type GroupName = keyof typeof COPY.groups;
type Entry = EntryRef | ToTranslate;

function EntryItem({ entry }: { readonly entry: Entry }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
      <span className="text-fg-muted w-28 shrink-0 font-mono text-xs">
        {KINDS[entry.kind]}
      </span>
      <Link
        href={ENTRY_PATHS[entry.kind](entry.id)}
        className="font-medium underline-offset-4 hover:underline"
      >
        {entry.label}
      </Link>
      {"english" in entry && (
        <span className="bg-signal/15 text-fg rounded-chip px-1.5 font-mono text-xs">
          {COPY.english[entry.english]}
        </span>
      )}
    </li>
  );
}

function EntryList({ entries }: { readonly entries: readonly Entry[] }) {
  return (
    // role="list": Safari drops list semantics once list-style is none.
    <ul role="list" className="divide-line divide-y">
      {entries.map((entry) => (
        <EntryItem key={`${entry.kind}:${entry.id}`} entry={entry} />
      ))}
    </ul>
  );
}

interface ToDoGroupProps {
  readonly name: GroupName;
  readonly entries: readonly Entry[];
}

/**
 * One kind of work left, entry by entry; past the first ones, the others
 * wait behind a disclosure. A group, not a region: the page keeps few landmarks.
 */
function ToDoGroup({ name, entries }: ToDoGroupProps) {
  const { title, hint } = COPY.groups[name];
  const id = `dashboard-${name}`;
  const others = entries.slice(MAX_SHOWN);
  return (
    <div role="group" aria-labelledby={id} className={TASK}>
      <h3 id={id} className="flex items-baseline gap-2 font-semibold">
        {title}{" "}
        <span className="text-fg-muted font-mono text-sm font-normal">
          ({entries.length})
        </span>
      </h3>
      <p className="text-fg-muted text-sm">{hint}</p>
      <EntryList entries={entries.slice(0, MAX_SHOWN)} />
      {others.length > 0 && (
        <details>
          <summary className="text-fg-muted hover:text-fg cursor-pointer text-sm">
            {COPY.more(others.length)}
          </summary>
          <EntryList entries={others} />
        </details>
      )}
    </div>
  );
}

/** The inbox, the work most waiting on someone: its count in large. */
function InboxCard({ unread }: { readonly unread: number | undefined }) {
  const hasUnread = unread !== undefined && unread > 0;
  return (
    <div
      role="group"
      aria-labelledby="dashboard-inbox"
      className={hasUnread ? TASK : INFO}
    >
      <h3 id="dashboard-inbox" className="font-semibold">
        {ADMIN_COPY.nav.messages}
      </h3>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        {unread === undefined ? (
          <p className="text-fg-muted">{COPY.messages(unread)}</p>
        ) : (
          // The count in large, and its words: one sentence, read at once.
          <p className={hasUnread ? "font-medium" : "text-fg-muted"}>
            <span
              className={`font-mono text-3xl tracking-tight ${hasUnread ? "text-accent" : ""}`}
            >
              {unread}
            </span>{" "}
            {COPY.unreadWords(unread)}
          </p>
        )}
        <Link href={ADMIN_PATHS.messages} className={`${LINK} text-sm`}>
          {COPY.openInbox}
        </Link>
      </div>
    </div>
  );
}

function groupsOf(content: ContentToDo) {
  return (
    [
      ["toTranslate", content.toTranslate],
      ["drafts", content.drafts],
      ["placeholders", content.placeholders],
      ["withoutImage", content.withoutImage],
    ] as const
  ).filter(([, entries]) => entries.length > 0);
}

interface ToDoSectionProps {
  /** Undefined when the messages could not be counted. */
  readonly unread: number | undefined;
  readonly content: Result<ContentToDo>;
}

/** The inbox first, then each kind of content work left. */
export function ToDoSection({ unread, content }: ToDoSectionProps) {
  const groups = content.ok ? groupsOf(content.data) : [];
  return (
    <section aria-labelledby="dashboard-to-do" className="flex flex-col gap-4">
      <h2 id="dashboard-to-do" className="text-xl font-semibold tracking-tight">
        {COPY.toDo}
      </h2>
      <InboxCard unread={unread} />
      {!content.ok && <p className="text-danger">{COPY.contentUnavailable}</p>}
      {content.ok && groups.length === 0 && (
        <p className="text-fg-muted">{COPY.nothingToDo}</p>
      )}
      {groups.map(([name, entries]) => (
        <ToDoGroup key={name} name={name} entries={entries} />
      ))}
    </section>
  );
}

function MediaGauge({ total }: { readonly total: number }) {
  const isFull = total >= MAX_MEDIA;
  return (
    <>
      <p aria-hidden="true" className="font-mono text-3xl tracking-tight">
        {total}
        <span className="text-fg-muted text-base">/{MAX_MEDIA}</span>
      </p>
      <div aria-hidden="true" className="bg-surface-muted h-1.5 rounded-full">
        <div
          style={{
            width: `${String(Math.min(100, (total / MAX_MEDIA) * 100))}%`,
          }}
          className={`h-full rounded-full ${isFull ? "bg-danger" : "bg-accent"}`}
        />
      </div>
    </>
  );
}

/** The library against its ceiling: a full one refuses new images. */
export function MediaPanel({
  media,
}: {
  readonly media: Result<MediaSummary>;
}) {
  const summary = media.ok ? media.data : undefined;
  return (
    <section aria-labelledby="dashboard-media" className={INFO}>
      <h2 id="dashboard-media" className={INFO_TITLE}>
        {COPY.media.title}
      </h2>
      {summary === undefined ? (
        <p className="text-danger text-sm">{COPY.media.unavailable}</p>
      ) : (
        <>
          <MediaGauge total={summary.total} />
          <p className="text-sm">
            {summary.total === 0
              ? COPY.media.empty
              : `${COPY.media.count(summary.total, MAX_MEDIA)}. ${COPY.media.unused(summary.unused)}`}
          </p>
          {summary.total >= MAX_MEDIA && (
            <p className="text-danger text-sm font-medium">{COPY.media.full}</p>
          )}
          <Link href={ADMIN_PATHS.media} className={`${LINK} text-sm`}>
            {COPY.media.open}
          </Link>
        </>
      )}
    </section>
  );
}

/** Where the platforms' collection will report its last run. */
export function StatsPanel() {
  return (
    <section aria-labelledby="dashboard-stats" className={INFO}>
      <h2 id="dashboard-stats" className={INFO_TITLE}>
        {COPY.stats.title}
      </h2>
      <p className="text-fg-muted border-line rounded-chip self-start border px-2 py-0.5 font-mono text-xs">
        {COPY.stats.never}
      </p>
      <p className="text-fg-muted text-sm">{COPY.stats.pending}</p>
    </section>
  );
}

/** The latest events of the audit log; the whole log is on the security page. */
export function ActivitySection({
  activity,
}: {
  readonly activity: Result<readonly AuditEntry[]>;
}) {
  return (
    <section
      aria-labelledby="dashboard-activity"
      className="flex flex-col gap-3"
    >
      <h2
        id="dashboard-activity"
        className="text-xl font-semibold tracking-tight"
      >
        {COPY.activity.title}
      </h2>
      {activity.ok ? (
        <AuditList entries={activity.data} />
      ) : (
        <p className="text-danger">{COPY.activity.unavailable}</p>
      )}
      <Link
        href={ADMIN_PATHS.security}
        className={`${LINK} self-start text-sm`}
      >
        {COPY.activity.all}
      </Link>
    </section>
  );
}
