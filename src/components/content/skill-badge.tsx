import { useLocale } from "next-intl";

import type { SkillRef } from "@/features/content/types";
import { skillAnchor } from "@/features/content/view-names";
import { Link } from "@/i18n/navigation";

interface SkillBadgeProps {
  readonly skill: SkillRef;
}

/** A skill, linked to its entry on the skills page (where it was used). */
export function SkillBadge({ skill }: SkillBadgeProps) {
  const locale = useLocale();

  return (
    <Link
      href={{ pathname: "/skills", hash: skillAnchor(skill.slug, locale) }}
      className="border-line bg-surface-muted text-fg hover:border-fg-muted rounded-chip inline-flex h-7 items-center border px-2.5 font-mono text-xs transition-colors"
    >
      {skill.name}
    </Link>
  );
}
