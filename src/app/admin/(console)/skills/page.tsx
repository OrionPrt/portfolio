import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SkillList } from "@/components/admin/content/skill-list";
import { ADMIN_COPY } from "@/components/admin/copy";
import { BUTTON_CLASSES } from "@/components/ui/button-classes";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import { createSkillsAdminRepository } from "@/features/catalog/skills-admin-repository";

export const metadata: Metadata = { title: ADMIN_COPY.skills.title };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.skills;

export default async function SkillsPage() {
  await requireAdmin();
  const loaded = await withDatabase((db) =>
    createSkillsAdminRepository(db).list(),
  );

  return (
    <>
      <AdminPageHeader title={COPY.title} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-fg-muted max-w-prose">{COPY.lead}</p>
        <Link href={ADMIN_PATHS.newSkill} className={BUTTON_CLASSES.primary}>
          {COPY.add}
        </Link>
      </div>
      {loaded.ok ? (
        <SkillList skills={loaded.data} />
      ) : (
        <p className="text-danger">{ADMIN_COPY.unavailable}</p>
      )}
    </>
  );
}
