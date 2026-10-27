import { skillPath } from "@/features/auth/admin-paths";
import {
  deleteSkillAction,
  moveSkillAction,
} from "@/features/catalog/skills-admin-actions";
import type { SkillListEntry } from "@/features/catalog/skills-admin-repository";
import { SKILL_DOMAINS } from "@/features/content/vocabulary";

import { ADMIN_COPY } from "../copy";
import { EntryGroup, EntryRow } from "./entry-list";

const COPY = ADMIN_COPY.skills;

interface SkillRowProps {
  readonly skill: SkillListEntry;
  readonly isFirst: boolean;
  readonly isLast: boolean;
}

function SkillRow({ skill, isFirst, isLast }: SkillRowProps) {
  return (
    <EntryRow
      id={skill.id}
      label={skill.name}
      badges={
        skill.featured ? [{ label: COPY.featuredBadge, tone: "accent" }] : []
      }
      details={
        <>
          <span className="font-mono">{skill.slug}</span> ·{" "}
          {COPY.usage(skill.projectCount, skill.experienceCount)}
        </>
      }
      editHref={skillPath(skill.id)}
      move={{ action: moveSkillAction, isFirst, isLast }}
      deleteAction={deleteSkillAction}
      deleteTitle={COPY.deleteTitle(skill.name)}
      deleteConsequence={COPY.deleteConsequence(
        skill.projectCount,
        skill.experienceCount,
      )}
    />
  );
}

interface SkillListProps {
  readonly skills: readonly SkillListEntry[];
}

/** The skills by domain, as the public page shows them; each domain keeps its own order. */
export function SkillList({ skills }: SkillListProps) {
  return (
    <div className="flex flex-col gap-8">
      {SKILL_DOMAINS.map((domain) => {
        const entries = skills.filter((skill) => skill.domain === domain);
        return (
          <EntryGroup
            key={domain}
            headingId={`skills-domain-${domain}`}
            title={COPY.domains[domain]}
            empty={COPY.empty}
            entries={entries}
            row={(skill, index) => (
              <SkillRow
                skill={skill}
                isFirst={index === 0}
                isLast={index === entries.length - 1}
              />
            )}
          />
        );
      })}
    </div>
  );
}
