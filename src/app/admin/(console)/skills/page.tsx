import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SkillList } from "@/components/admin/content/skill-list";
import { ListIntro } from "@/components/admin/content/entry-pages";
import { ADMIN_COPY } from "@/components/admin/copy";
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
      <ListIntro
        lead={COPY.lead}
        addHref={ADMIN_PATHS.newSkill}
        addLabel={COPY.add}
      />
      {loaded.ok ? (
        <SkillList skills={loaded.data} />
      ) : (
        <p className="text-danger">{ADMIN_COPY.unavailable}</p>
      )}
    </>
  );
}
