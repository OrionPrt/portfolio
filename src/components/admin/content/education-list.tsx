import { educationPath } from "@/features/auth/admin-paths";
import { deleteEducationAction } from "@/features/catalog/education-admin-actions";
import type { EducationListEntry } from "@/features/catalog/education-admin-repository";

import { ADMIN_COPY } from "../copy";
import { formatPeriod } from "../format";
import { EntryList, EntryRow, englishBadges } from "./entry-list";

const COPY = ADMIN_COPY.education;

interface EducationListProps {
  readonly entries: readonly EducationListEntry[];
}

/** The entries as the site sorts them, by date: no order to set by hand. */
export function EducationList({ entries }: EducationListProps) {
  return (
    <EntryList
      entries={entries}
      empty={COPY.empty}
      row={(entry) => {
        const label = ADMIN_COPY.entries.label(entry.degree, entry.school);
        return (
          <EntryRow
            id={entry.id}
            label={label}
            badges={englishBadges(entry.english)}
            details={formatPeriod(entry.startedOn, entry.endedOn)}
            editHref={educationPath(entry.id)}
            deleteAction={deleteEducationAction}
            deleteTitle={COPY.deleteTitle(label)}
            deleteConsequence={COPY.deleteConsequence}
          />
        );
      }}
    />
  );
}
