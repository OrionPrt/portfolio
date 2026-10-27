import { experiencePath } from "@/features/auth/admin-paths";
import { deleteExperienceAction } from "@/features/experiences/admin-actions";
import type { ExperienceListEntry } from "@/features/experiences/admin-repository";

import { ADMIN_COPY } from "../copy";
import { formatMonthYear } from "../format";
import { EntryList, EntryRow, entryBadges } from "./entry-list";

const COPY = ADMIN_COPY.experiences;

interface ExperienceListProps {
  readonly experiences: readonly ExperienceListEntry[];
}

/** The experiences as the site sorts them, by date: no order to set by hand. */
export function ExperienceList({ experiences }: ExperienceListProps) {
  return (
    <EntryList
      entries={experiences}
      empty={COPY.empty}
      row={(experience) => {
        const label = COPY.label(experience.role, experience.company);
        return (
          <EntryRow
            id={experience.id}
            label={label}
            badges={entryBadges(experience.status, experience.english)}
            details={
              <>
                {COPY.period(
                  formatMonthYear(experience.startedOn),
                  experience.endedOn === null
                    ? undefined
                    : formatMonthYear(experience.endedOn),
                )}{" "}
                · <span className="font-mono">{experience.slug}</span>
              </>
            }
            editHref={experiencePath(experience.id)}
            deleteAction={deleteExperienceAction}
            deleteTitle={COPY.deleteTitle(label)}
            deleteConsequence={ADMIN_COPY.entries.deleteConsequence}
          />
        );
      }}
    />
  );
}
