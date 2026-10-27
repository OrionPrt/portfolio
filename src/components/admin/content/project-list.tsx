import { projectPath } from "@/features/auth/admin-paths";
import {
  deleteProjectAction,
  moveProjectAction,
} from "@/features/projects/admin-actions";
import type { ProjectListEntry } from "@/features/projects/admin-repository";

import { ADMIN_COPY } from "../copy";
import { EntryGroup, EntryRow, entryBadges } from "./entry-list";

const COPY = ADMIN_COPY.projects;
const ENTRIES = ADMIN_COPY.entries;

const GROUPS = [
  { key: "featured", isFeatured: true },
  { key: "others", isFeatured: false },
] as const;

interface ProjectListProps {
  readonly projects: readonly ProjectListEntry[];
}

/** The featured projects, then the others, as the site shows them; each group keeps its order. */
export function ProjectList({ projects }: ProjectListProps) {
  return (
    <div className="flex flex-col gap-8">
      {GROUPS.map(({ key, isFeatured }) => {
        const entries = projects.filter(
          (project) => project.featured === isFeatured,
        );
        return (
          <EntryGroup
            key={key}
            headingId={`projects-${key}`}
            title={COPY.groups[key]}
            empty={COPY.empty[key]}
            entries={entries}
            row={(project, index) => (
              <EntryRow
                id={project.id}
                label={project.title}
                badges={entryBadges(project.status, project.english)}
                details={<span className="font-mono">{project.slug}</span>}
                editHref={projectPath(project.id)}
                move={{
                  action: moveProjectAction,
                  isFirst: index === 0,
                  isLast: index === entries.length - 1,
                }}
                deleteAction={deleteProjectAction}
                deleteTitle={COPY.deleteTitle(project.title)}
                deleteConsequence={ENTRIES.deleteConsequence}
              />
            )}
          />
        );
      })}
    </div>
  );
}
