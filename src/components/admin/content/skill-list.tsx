import Link from "next/link";

import { skillPath } from "@/features/auth/admin-paths";
import {
  deleteSkillAction,
  moveSkillAction,
} from "@/features/catalog/skills-admin-actions";
import type { SkillListEntry } from "@/features/catalog/skills-admin-repository";
import { SKILL_DOMAINS, type SkillDomain } from "@/features/content/vocabulary";

import { ADMIN_COPY } from "../copy";
import { DeleteEntry, MoveButtons } from "./list-actions";

const COPY = ADMIN_COPY.skills;

interface SkillRowProps {
  readonly skill: SkillListEntry;
  readonly isFirst: boolean;
  readonly isLast: boolean;
}

function SkillRow({ skill, isFirst, isLast }: SkillRowProps) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{skill.name}</span>
          {skill.featured && (
            <span className="bg-accent/15 text-fg rounded-chip px-1.5 font-mono text-xs">
              {COPY.featuredBadge}
            </span>
          )}
        </p>
        <p className="text-fg-muted text-sm">
          <span className="font-mono">{skill.slug}</span> ·{" "}
          {COPY.usage(skill.projectCount, skill.experienceCount)}
        </p>
      </div>
      <MoveButtons
        action={moveSkillAction}
        id={skill.id}
        label={skill.name}
        isFirst={isFirst}
        isLast={isLast}
      />
      <Link
        href={skillPath(skill.id)}
        className="border-line hover:border-fg-muted rounded-control inline-flex min-h-10 items-center border px-3 text-sm font-medium"
      >
        {COPY.edit} <span className="sr-only">{skill.name}</span>
      </Link>
      <DeleteEntry
        action={deleteSkillAction}
        id={skill.id}
        label={skill.name}
        title={COPY.deleteTitle(skill.name)}
        consequence={COPY.deleteConsequence(
          skill.projectCount,
          skill.experienceCount,
        )}
      />
    </li>
  );
}

interface SkillListProps {
  readonly skills: readonly SkillListEntry[];
}

/** The skills by domain, as the public page shows them; each domain keeps its own order. */
export function SkillList({ skills }: SkillListProps) {
  const byDomain = (domain: SkillDomain) =>
    skills.filter((skill) => skill.domain === domain);
  return (
    <div className="flex flex-col gap-8">
      {SKILL_DOMAINS.map((domain) => {
        const entries = byDomain(domain);
        const headingId = `skills-domain-${domain}`;
        return (
          <section
            key={domain}
            aria-labelledby={headingId}
            className="flex flex-col gap-3"
          >
            <h2 id={headingId} className="text-xl font-semibold tracking-tight">
              {COPY.domains[domain]}
            </h2>
            {entries.length === 0 ? (
              <p className="text-fg-muted">{COPY.empty}</p>
            ) : (
              // role="list": Safari drops list semantics once list-style is none.
              <ol
                role="list"
                className="border-line bg-surface rounded-tile divide-line divide-y border"
              >
                {entries.map((skill, index) => (
                  <SkillRow
                    key={skill.id}
                    skill={skill}
                    isFirst={index === 0}
                    isLast={index === entries.length - 1}
                  />
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
