import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BackLink } from "@/components/admin/content/back-link";
import { DeleteEntry } from "@/components/admin/content/list-actions";
import { ExperienceForm } from "@/components/admin/content/experience-form";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import { loadSkillOptions } from "@/features/catalog/skill-options";
import {
  deleteExperienceAction,
  updateExperienceAction,
} from "@/features/experiences/admin-actions";
import { createExperiencesAdminRepository } from "@/features/experiences/admin-repository";

export const metadata: Metadata = { title: ADMIN_COPY.experiences.editTitle };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.experiences;

export default async function EditExperiencePage({
  params,
}: PageProps<"/admin/experiences/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [found, skills] = await Promise.all([
    withDatabase((db) => createExperiencesAdminRepository(db).find(id)),
    withDatabase(loadSkillOptions),
  ]);
  const experience = found.ok ? found.data : undefined;
  const isAvailable = found.ok && skills.ok;
  const label =
    experience === undefined
      ? ""
      : COPY.label(experience.translations.fr?.role, experience.company);

  return (
    <>
      <AdminPageHeader title={COPY.editTitle} />
      <BackLink href={ADMIN_PATHS.experiences} label={COPY.back} />
      {experience !== undefined && skills.ok ? (
        <>
          {/* Keyed: another experience's page keeps its own form state. */}
          <ExperienceForm
            key={experience.id}
            action={updateExperienceAction}
            experience={experience}
            skills={skills.data}
          />
          <div className="border-line border-t pt-6">
            <DeleteEntry
              action={deleteExperienceAction}
              id={experience.id}
              label={label}
              title={COPY.deleteTitle(label)}
              afterDelete={ADMIN_PATHS.experiences}
              consequence={ADMIN_COPY.entries.deleteConsequence}
            />
          </div>
        </>
      ) : (
        <p className={isAvailable ? undefined : "text-danger"}>
          {isAvailable ? COPY.notFound : ADMIN_COPY.unavailable}
        </p>
      )}
    </>
  );
}
