import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BackLink } from "@/components/admin/content/back-link";
import { SkillForm } from "@/components/admin/content/skill-form";
import { ADMIN_COPY } from "@/components/admin/copy";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import { createSkillAction } from "@/features/catalog/skills-admin-actions";

export const metadata: Metadata = { title: ADMIN_COPY.skills.newTitle };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.skills;

export default async function NewSkillPage() {
  await requireAdmin();

  return (
    <>
      <AdminPageHeader title={COPY.newTitle} />
      <BackLink href={ADMIN_PATHS.skills} label={COPY.back} />
      <SkillForm action={createSkillAction} />
    </>
  );
}
