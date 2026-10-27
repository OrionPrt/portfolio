import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BackLink } from "@/components/admin/content/back-link";
import { DeleteEntry } from "@/components/admin/content/list-actions";
import { SkillForm } from "@/components/admin/content/skill-form";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import {
  deleteSkillAction,
  updateSkillAction,
} from "@/features/catalog/skills-admin-actions";
import { createSkillsAdminRepository } from "@/features/catalog/skills-admin-repository";

export const metadata: Metadata = { title: ADMIN_COPY.skills.editTitle };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.skills;

export default async function EditSkillPage({
  params,
}: PageProps<"/admin/skills/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const found = await withDatabase((db) =>
    createSkillsAdminRepository(db).find(id),
  );

  return (
    <>
      <AdminPageHeader title={COPY.editTitle} />
      <BackLink href={ADMIN_PATHS.skills} label={COPY.back} />
      {found.ok && found.data !== undefined ? (
        <>
          {/* Keyed: another skill's page keeps its own form state. */}
          <SkillForm
            key={found.data.id}
            action={updateSkillAction}
            skill={found.data}
          />
          <div className="border-line border-t pt-6">
            <DeleteEntry
              action={deleteSkillAction}
              id={found.data.id}
              label={found.data.name}
              title={COPY.deleteTitle(found.data.name)}
              afterDelete={ADMIN_PATHS.skills}
              consequence={COPY.deleteConsequence(
                found.data.projectCount,
                found.data.experienceCount,
              )}
            />
          </div>
        </>
      ) : (
        <p className={found.ok ? undefined : "text-danger"}>
          {found.ok ? COPY.notFound : ADMIN_COPY.unavailable}
        </p>
      )}
    </>
  );
}
