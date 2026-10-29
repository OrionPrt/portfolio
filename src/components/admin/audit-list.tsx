import type { AuditEntry } from "@/features/auth/audit-repository";
import { AUDIT_ACTIONS, type AuditAction } from "@/features/auth/vocabulary";

import { ADMIN_COPY } from "./copy";
import { describeUserAgent, formatParisDateTime } from "./format";

const COPY = ADMIN_COPY.security.audit;

function labelOf(action: string): string {
  const known = AUDIT_ACTIONS.find((candidate) => candidate === action);
  return known === undefined
    ? action
    : COPY.actions[known satisfies AuditAction];
}

/** What a content event changed: "projet"; undefined for other events. */
function entityOf(entity: string | null): string | undefined {
  return entity !== null && Object.hasOwn(COPY.entities, entity)
    ? COPY.entities[entity]
    : undefined;
}

/** A stored key or value in words; own entries only ("constructor" stays as is). */
function wordFor(stored: string): string {
  return Object.hasOwn(COPY.details, stored)
    ? (COPY.details[stored] ?? stored)
    : stored;
}

/** "méthode : totp" from a diff of plain values; anything else is left out. */
function detailsOf(diff: unknown): string | undefined {
  if (typeof diff !== "object" || diff === null) {
    return undefined;
  }
  const parts = Object.entries(diff)
    .filter(
      ([, value]) => typeof value === "string" || typeof value === "number",
    )
    .map(([key, value]) => {
      const text = String(value);
      return `${wordFor(key)}\u00a0: ${wordFor(text)}`;
    });
  return parts.length === 0 ? undefined : parts.join(", ");
}

interface AuditListProps {
  readonly entries: readonly AuditEntry[];
}

/** The latest events, newest first. Networks appear only as a short hash. */
export function AuditList({ entries }: AuditListProps) {
  if (entries.length === 0) {
    return <p className="text-fg-muted">{COPY.empty}</p>;
  }
  return (
    // role="list": Safari drops list semantics once list-style is none.
    <ol role="list" className="divide-line flex flex-col divide-y text-sm">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3"
        >
          <time
            dateTime={entry.createdAt.toISOString()}
            className="text-fg-muted w-40 shrink-0 font-mono text-xs"
          >
            {formatParisDateTime(entry.createdAt)}
          </time>
          <span className="font-medium">
            {labelOf(entry.action)}
            {entityOf(entry.entity) !== undefined && (
              <span className="text-fg-muted font-normal">
                {` · ${entityOf(entry.entity) ?? ""}`}
              </span>
            )}
          </span>
          {detailsOf(entry.diff) !== undefined && (
            <span className="text-fg-muted">{detailsOf(entry.diff)}</span>
          )}
          <span className="text-fg-muted ml-auto font-mono text-xs">
            {[
              describeUserAgent(entry.userAgent),
              entry.ipHash === null
                ? undefined
                : `réseau ${entry.ipHash.slice(0, 8)}`,
            ]
              .filter((part) => part !== undefined)
              .join(" · ")}
          </span>
        </li>
      ))}
    </ol>
  );
}
